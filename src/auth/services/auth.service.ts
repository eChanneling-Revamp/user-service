import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  Inject,
  Logger,
  HttpException,
  HttpStatus,
  Optional,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SupabaseClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcrypt';
import { SUPABASE_CLIENT } from '../../database/supabase.provider';
import { MailService } from '../../mail/mail.service';
import { RegisterUserDto } from '../dto/register-user.dto';
import { LoginEmailDto } from '../dto/login-email.dto';
import { SendOtpDto } from '../dto/send-otp.dto';
import { VerifyOtpDto } from '../dto/verify-otp.dto';
import { RESTRICTED_ROLES } from '../../common/enums/role.enum';
import { User } from '../../common/interfaces/user.interface';
import { RefreshTokenDto } from '../dto/refresh-token.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private azureAuthUrl: string = '';

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {
    // Initialize Azure auth URL
    this.initializeAzureAuthUrl();
  }

  /**
   * Build Google OAuth authorization URL for testing (returns URL string)
   */
  getGoogleAuthUrl(): string {
    const clientId = this.configService.get<string>('google.clientId');
    const redirectUri = this.configService.get<string>('google.callbackURL');
    const scope = ['openid', 'profile', 'email'].join(' ');

    if (!clientId || !redirectUri) {
      return '';
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope,
      include_granted_scopes: 'true',
      access_type: 'offline',
      prompt: 'consent',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  private initializeAzureAuthUrl() {
    const tenantId =
      this.configService.get<string>('AZURE_AD_TENANT_ID') ||
      this.configService.get<string>('AZURE_TENANT') ||
      this.configService.get<string>('azure.tenantId');

    const clientId =
      this.configService.get<string>('AZURE_AD_CLIENT_ID') ||
      this.configService.get<string>('AZURE_CLIENT_ID') ||
      this.configService.get<string>('azure.clientId');

    const redirectUri =
      this.configService.get<string>('AZURE_AD_CALLBACK_URL') ||
      this.configService.get<string>('AZURE_REDIRECT_URI') ||
      this.configService.get<string>('AZURE_REDIRECT_URI') ||
      this.configService.get<string>('azure.callbackURL') ||
      this.configService.get<string>('azure.callbackUrl');

    if (tenantId && clientId && redirectUri) {
      const scopes = ['user.read', 'openid', 'profile', 'email'].join(' ');
      this.azureAuthUrl =
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
        `client_id=${clientId}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scopes)}`;
    } else {
      this.logger.warn(
        'Azure AD OAuth not fully configured - missing tenantId/clientId/redirectUri',
      );
      this.azureAuthUrl = '';
    }
  }

  /**
   * Register a new user
   */
  async register(registerDto: RegisterUserDto) {
    // Validate passwords match
    if (registerDto.password !== registerDto.confirm_password) {
      throw new BadRequestException('Passwords do not match');
    }

    // Check if role is restricted
    if (RESTRICTED_ROLES.includes(registerDto.role)) {
      throw new BadRequestException(
        'Cannot register with admin or super_admin role. These roles must be assigned directly in Supabase.',
      );
    }

    // Check if user already exists
    const { data: existingUser } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', registerDto.email)
      .single();

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Check if phone number already exists
    const { data: existingPhone } = await this.supabase
      .from('users')
      .select('*')
      .eq('phone_number', registerDto.phone_number)
      .single();

    if (existingPhone) {
      throw new ConflictException('User with this phone number already exists');
    }

    // Check if NIC already exists
    const { data: existingNic } = await this.supabase
      .from('users')
      .select('*')
      .eq('nic', registerDto.nic)
      .single();

    if (existingNic) {
      throw new ConflictException('User with this NIC already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Create user in Supabase
    const { data: newUser, error } = await this.supabase
      .from('users')
      .insert([
        {
          email: registerDto.email,
          password: hashedPassword,
          first_name: registerDto.first_name,
          last_name: registerDto.last_name,
          nic: registerDto.nic,
          phone_number: registerDto.phone_number,
          role: registerDto.role,
          age: registerDto.age,
          gender: registerDto.gender,
        },
      ])
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to create user', error);
      throw new HttpException('Failed to create user', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // Send welcome email
    await this.mailService.sendWelcomeEmail(newUser.email, newUser.first_name);

    // Generate access + refresh tokens and store refresh
    const tokens = await this.createAndStoreTokens(newUser);

    return {
      message: 'User registered successfully',
      user: this.sanitizeUser(newUser),
      tokens,
    };
  }

  /**
   * Login with email and password (for web)
   */
  async loginWithEmail(loginDto: LoginEmailDto) {
    // Find user by email
    const { data: user, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', loginDto.email)
      .single();

    if (error || !user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Generate access + refresh tokens and store refresh
    const tokens = await this.createAndStoreTokens(user);

    return {
      message: 'Login successful',
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  /**
   * Send OTP to user's email (for mobile login)
   */
  async sendOtp(sendOtpDto: SendOtpDto) {
    // Find user by phone number
    const { data: user, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('phone_number', sendOtpDto.phone_number)
      .single();

    if (error || !user) {
      throw new BadRequestException('User with this phone number not found');
    }

    // Check if OTP was recently sent (cooldown)
    const { data: existingOtp } = await this.supabase
      .from('otps')
      .select('*')
      .eq('email', user.email)
      .single();

    if (existingOtp) {
      const lastSent = new Date(existingOtp.created_at);
      const now = new Date();
      const cooldownSeconds = this.configService.get<number>('otp.cooldownSeconds');
      const secondsSinceLastSent = (now.getTime() - lastSent.getTime()) / 1000;

      if (secondsSinceLastSent < cooldownSeconds) {
        throw new HttpException(
          `Please wait ${Math.ceil(cooldownSeconds - secondsSinceLastSent)} seconds before requesting a new OTP`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // Generate 6-digit OTP
    const otp = this.generateOtp();

    // Store OTP in database
    const expiryMinutes = this.configService.get<number>('otp.expiryMinutes');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiryMinutes);

    await this.supabase.from('otps').upsert(
      {
        email: user.email,
        otp,
        created_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        attempts: 0,
      },
      { onConflict: 'email' },
    );

    // Send OTP email
    const emailSent = await this.mailService.sendOtpEmail(user.email, otp);

    if (!emailSent) {
      throw new HttpException(
        'Failed to send OTP email. Please try again.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      message: 'OTP sent successfully to your registered email',
      email: this.maskEmail(user.email),
    };
  }

  /**
   * Verify OTP and login (for mobile)
   */
  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    // Find user by phone number
    const { data: user, error: userError } = await this.supabase
      .from('users')
      .select('*')
      .eq('phone_number', verifyOtpDto.phone_number)
      .single();

    if (userError || !user) {
      throw new BadRequestException('User with this phone number not found');
    }

    // Find OTP record
    const { data: otpRecord, error: otpError } = await this.supabase
      .from('otps')
      .select('*')
      .eq('email', user.email)
      .single();

    if (otpError || !otpRecord) {
      throw new UnauthorizedException('OTP not found or expired');
    }

    // Check if OTP has expired
    const expiresAt = new Date(otpRecord.expires_at);
    const now = new Date();

    if (now > expiresAt) {
      // Delete expired OTP
      await this.supabase.from('otps').delete().eq('email', user.email);
      throw new UnauthorizedException('OTP has expired. Please request a new one.');
    }

    // Verify OTP
    if (otpRecord.otp !== verifyOtpDto.otp) {
      // Increment attempts
      const newAttempts = (otpRecord.attempts || 0) + 1;

      if (newAttempts >= 5) {
        // Delete OTP after 5 failed attempts
        await this.supabase.from('otps').delete().eq('email', user.email);
        throw new UnauthorizedException('Too many failed attempts. Please request a new OTP.');
      }

      await this.supabase.from('otps').update({ attempts: newAttempts }).eq('email', user.email);

      throw new UnauthorizedException('Invalid OTP');
    }

    // OTP is valid - delete it
    await this.supabase.from('otps').delete().eq('email', user.email);

    // Generate access + refresh tokens and store refresh
    const tokens = await this.createAndStoreTokens(user);

    return {
      message: 'Login successful',
      user: this.sanitizeUser(user),
      tokens,
    };
  }

  /**
   * Handle Google OAuth login/registration
   */
  async handleGoogleLogin(googleUser: any) {
    // Check if user exists
    const { data: existingUser } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', googleUser.email)
      .single();

    if (existingUser) {
      // User exists, generate token
      const tokens = await this.createAndStoreTokens(existingUser);
      return {
        message: 'Login successful',
        user: this.sanitizeUser(existingUser),
        tokens,
      };
    }

    // User doesn't exist - create new user with patient role by default
    const { data: newUser, error } = await this.supabase
      .from('users')
      .insert([
        {
          email: googleUser.email,
          first_name: googleUser.firstName,
          last_name: googleUser.lastName,
          role: 'patient', // Default role for OAuth users
          password: '', // No password for OAuth users
        },
      ])
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to create user from Google OAuth', error);
      throw new HttpException('Failed to create user', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const tokens = await this.createAndStoreTokens(newUser);

    return {
      message: 'User registered and logged in successfully',
      user: this.sanitizeUser(newUser),
      tokens,
    };
  }

  /**
   * Handle Azure AD OAuth login/registration
   */
  async handleAzureLogin(azureUser: any) {
    // Check if user exists
    const { data: existingUser } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', azureUser.email)
      .single();

    if (existingUser) {
      // User exists, generate token
      const tokens = await this.createAndStoreTokens(existingUser);
      return {
        message: 'Login successful',
        user: this.sanitizeUser(existingUser),
        tokens,
      };
    }

    // User doesn't exist - create new user with patient role by default
    const { data: newUser, error } = await this.supabase
      .from('users')
      .insert([
        {
          email: azureUser.email,
          first_name: azureUser.firstName,
          last_name: azureUser.lastName,
          role: 'patient', // Default role for OAuth users
          password: '', // No password for OAuth users
        },
      ])
      .select()
      .single();

    if (error) {
      this.logger.error('Failed to create user from Azure AD OAuth', error);
      throw new HttpException('Failed to create user', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const tokens = await this.createAndStoreTokens(newUser);

    return {
      message: 'User registered and logged in successfully',
      user: this.sanitizeUser(newUser),
      tokens,
    };
  }

  /**
   * Get Azure AD authorization URL
   */
  getAzureAuthUrl(): string {
    return this.azureAuthUrl;
  }

  /**
   * Request password reset - sends OTP to user's email
   */
  async requestPasswordReset(email: string) {
    // Find user by email
    const { data: user, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      // Don't reveal if user exists or not for security
      return {
        message: 'If an account with that email exists, a password reset OTP has been sent.',
        email: this.maskEmail(email),
      };
    }

    // Check if OTP was recently sent (cooldown)
    const { data: existingOtp } = await this.supabase
      .from('otps')
      .select('*')
      .eq('email', user.email)
      .single();

    if (existingOtp) {
      const lastSent = new Date(existingOtp.created_at);
      const now = new Date();
      const cooldownSeconds = this.configService.get<number>('otp.cooldownSeconds');
      const secondsSinceLastSent = (now.getTime() - lastSent.getTime()) / 1000;

      if (secondsSinceLastSent < cooldownSeconds) {
        throw new HttpException(
          `Please wait ${Math.ceil(cooldownSeconds - secondsSinceLastSent)} seconds before requesting a new OTP`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // Generate 6-digit OTP
    const otp = this.generateOtp();

    // Store OTP in database
    const expiryMinutes = this.configService.get<number>('otp.expiryMinutes');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiryMinutes);

    await this.supabase.from('otps').upsert(
      {
        email: user.email,
        otp,
        created_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        attempts: 0,
      },
      { onConflict: 'email' },
    );

    // Send password reset email
    const emailSent = await this.mailService.sendPasswordResetEmail(user.email, otp);

    if (!emailSent) {
      throw new HttpException(
        'Failed to send password reset email. Please try again.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      message: 'Password reset OTP sent successfully to your email',
      email: this.maskEmail(user.email),
    };
  }

  /**
   * Reset password using OTP verification
   */
  async resetPassword(resetDto: any) {
    // Validate passwords match
    if (resetDto.new_password !== resetDto.confirm_password) {
      throw new BadRequestException('Passwords do not match');
    }

    // Find user by email
    const { data: user, error: userError } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', resetDto.email)
      .single();

    if (userError || !user) {
      throw new UnauthorizedException('Invalid email or OTP');
    }

    // Find OTP record
    const { data: otpRecord, error: otpError } = await this.supabase
      .from('otps')
      .select('*')
      .eq('email', resetDto.email)
      .single();

    if (otpError || !otpRecord) {
      throw new UnauthorizedException('OTP not found or expired');
    }

    // Check if OTP has expired
    const expiresAt = new Date(otpRecord.expires_at);
    const now = new Date();

    if (now > expiresAt) {
      // Delete expired OTP
      await this.supabase.from('otps').delete().eq('email', resetDto.email);
      throw new UnauthorizedException('OTP has expired. Please request a new one.');
    }

    // Verify OTP
    if (otpRecord.otp !== resetDto.otp) {
      // Increment attempts
      const newAttempts = (otpRecord.attempts || 0) + 1;

      if (newAttempts >= 5) {
        // Delete OTP after 5 failed attempts
        await this.supabase.from('otps').delete().eq('email', resetDto.email);
        throw new UnauthorizedException('Too many failed attempts. Please request a new OTP.');
      }

      await this.supabase
        .from('otps')
        .update({ attempts: newAttempts })
        .eq('email', resetDto.email);

      throw new UnauthorizedException('Invalid OTP');
    }

    // OTP is valid - hash new password
    const hashedPassword = await bcrypt.hash(resetDto.new_password, 10);

    // Update user password
    const { error: updateError } = await this.supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('email', resetDto.email);

    if (updateError) {
      this.logger.error('Failed to update password', updateError);
      throw new HttpException('Failed to reset password', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // Delete the used OTP
    await this.supabase.from('otps').delete().eq('email', resetDto.email);

    return {
      message: 'Password reset successfully. You can now login with your new password.',
    };
  }

  /**
   * Generate JWT token
   */
  private generateToken(user: any): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return this.jwtService.sign(payload);
  }

  /**
   * Create access + refresh tokens and persist refresh token (hashed)
   */
  async createAndStoreTokens(user: any): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.refreshSecret'),
      expiresIn: this.configService.get<string>('jwt.refreshExpiresIn'),
    });

    // Hash refresh token before storing
    const hashed = await bcrypt.hash(refreshToken, 10);

    // Compute expires_at for refresh token
    const expiresInStr = this.configService.get<string>('jwt.refreshExpiresIn') || '7d';
    const expiresAt = this.computeExpiryDate(expiresInStr);

    await this.supabase.from('refresh_tokens').insert([
      {
        user_id: user.id,
        token: hashed,
        expires_at: expiresAt.toISOString(),
      },
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Compute a Date from an expiresIn string like '7d', '24h', '3600s'
   */
  private computeExpiryDate(expiresIn: string): Date {
    const now = new Date();

    const dayMatch = expiresIn.match(/^(\d+)d$/);
    const hourMatch = expiresIn.match(/^(\d+)h$/);
    const minMatch = expiresIn.match(/^(\d+)m$/);
    const secMatch = expiresIn.match(/^(\d+)s$/);
    const numMatch = expiresIn.match(/^(\d+)$/);

    if (dayMatch) {
      now.setDate(now.getDate() + parseInt(dayMatch[1], 10));
      return now;
    }
    if (hourMatch) {
      now.setHours(now.getHours() + parseInt(hourMatch[1], 10));
      return now;
    }
    if (minMatch) {
      now.setMinutes(now.getMinutes() + parseInt(minMatch[1], 10));
      return now;
    }
    if (secMatch) {
      now.setSeconds(now.getSeconds() + parseInt(secMatch[1], 10));
      return now;
    }
    if (numMatch) {
      // assume seconds
      now.setSeconds(now.getSeconds() + parseInt(numMatch[1], 10));
      return now;
    }

    // Fallback: add 7 days
    now.setDate(now.getDate() + 7);
    return now;
  }

  /**
   * Refresh access token using a valid (non-revoked, unexpired) refresh token
   */
  async refresh(refreshDto: RefreshTokenDto) {
    const { refreshToken } = refreshDto;
    const secret = this.configService.get<string>('jwt.refreshSecret');

    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, { secret });
    } catch (err) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const userId = payload.sub;

    // Fetch user's refresh tokens (include revoked to detect reuse)
    const { data: rows } = await this.supabase
      .from('refresh_tokens')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!rows || rows.length === 0) {
      throw new UnauthorizedException('Refresh token not found');
    }

    // Find a matching token (compare hashed values). Also detect reuse if the matching token is revoked.
    let matched: any = null;
    for (const row of rows) {
      const isMatch = await bcrypt.compare(refreshToken, row.token);
      if (!isMatch) continue;

      // If the token is found but already revoked -> reuse detected
      if (row.revoked) {
        this.logger.warn(
          `Detected refresh token reuse for user ${userId}, revoking all refresh tokens.`,
        );
        // Revoke all refresh tokens for this user (security measure)
        await this.supabase.from('refresh_tokens').update({ revoked: true }).eq('user_id', userId);
        throw new UnauthorizedException('Refresh token reuse detected; all refresh tokens revoked');
      }

      // Check expiry
      if (new Date(row.expires_at) < new Date()) continue;

      matched = row;
      break;
    }

    if (!matched) {
      throw new UnauthorizedException('Refresh token invalid or expired');
    }

    // Load user
    const { data: user } = await this.supabase.from('users').select('*').eq('id', userId).single();
    if (!user) throw new UnauthorizedException('User not found');

    // Revoke the old refresh token (rotation)
    await this.supabase.from('refresh_tokens').update({ revoked: true }).eq('id', matched.id);

    // Issue new tokens
    const tokens = await this.createAndStoreTokens(user);

    return { message: 'Token refreshed', tokens };
  }

  /**
   * Admin: revoke all refresh tokens for a user
   */
  async revokeAllRefreshTokensForUser(userId: string) {
    await this.supabase.from('refresh_tokens').update({ revoked: true }).eq('user_id', userId);
    return { message: `Revoked all refresh tokens for user ${userId}` };
  }

  /**
   * Delete a user and all associated data
   * @param userId - The UUID of the user to delete
   * @returns The deleted user's id and email
   */
  async deleteUser(userId: string): Promise<{ id: string; email: string }> {
    // Validate userId input
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    try {
      // 1. Validate user exists
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        throw new NotFoundException(`User with id ${userId} not found`);
      }

      const userEmail = user.email;

      // 2. Revoke all refresh tokens for the user
      await this.revokeAllRefreshTokensForUser(userId);

      // 3. Delete refresh tokens for the user
      const { error: deleteTokensError } = await this.supabase
        .from('refresh_tokens')
        .delete()
        .eq('user_id', userId);

      if (deleteTokensError) {
        this.logger.error('Failed to delete refresh tokens', deleteTokensError);
        throw new InternalServerErrorException('Failed to delete user refresh tokens');
      }

      // 4. Delete OTPs for the user's email
      const { error: deleteOtpsError } = await this.supabase
        .from('otps')
        .delete()
        .eq('email', userEmail);

      if (deleteOtpsError) {
        this.logger.error('Failed to delete OTPs', deleteOtpsError);
        throw new InternalServerErrorException('Failed to delete user OTPs');
      }

      // 5. Delete the user
      const { error: deleteUserError } = await this.supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (deleteUserError) {
        this.logger.error('Failed to delete user', deleteUserError);
        throw new InternalServerErrorException('Failed to delete user');
      }

      this.logger.log(`User ${userId} deleted successfully`);

      return { id: userId, email: userEmail };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error('Unexpected error during user deletion', error);
      throw new InternalServerErrorException('An unexpected error occurred during user deletion');
    }
  }

  /**
   * Logout - revoke refresh token
   */
  async logout(refreshDto: RefreshTokenDto) {
    const { refreshToken } = refreshDto;
    const secret = this.configService.get<string>('jwt.refreshSecret');

    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, { secret });
    } catch (err) {
      // Still try to find and revoke any matching hashed token
    }

    // Try to find matching hashed token for any user and revoke it
    const { data: rows } = await this.supabase.from('refresh_tokens').select('*');
    if (rows && rows.length > 0) {
      for (const row of rows) {
        const isMatch = await bcrypt.compare(refreshToken, row.token);
        if (isMatch) {
          await this.supabase.from('refresh_tokens').update({ revoked: true }).eq('id', row.id);
          return { message: 'Logged out' };
        }
      }
    }

    return { message: 'No matching token found' };
  }

  /**
   * Generate 6-digit OTP
   */
  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Mask email for privacy
   */
  private maskEmail(email: string): string {
    const [username, domain] = email.split('@');
    const maskedUsername = username.substring(0, 2) + '***' + username.slice(-1);
    return `${maskedUsername}@${domain}`;
  }

  /**
   * Remove sensitive data from user object
   */
  private sanitizeUser(user: any): Partial<User> {
    const { password, ...sanitized } = user;
    return sanitized;
  }
}
