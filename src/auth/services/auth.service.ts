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
      this.azureAuthUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
        `client_id=${clientId}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scopes)}`;
    } else {
      this.logger.warn('Azure AD OAuth not fully configured - missing tenantId/clientId/redirectUri');
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

    // Generate JWT token
    const token = this.generateToken(newUser);

    return {
      message: 'User registered successfully',
      user: this.sanitizeUser(newUser),
      token,
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

    // Generate JWT token
    const token = this.generateToken(user);

    return {
      message: 'Login successful',
      user: this.sanitizeUser(user),
      token,
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
        throw new UnauthorizedException(
          'Too many failed attempts. Please request a new OTP.',
        );
      }

      await this.supabase
        .from('otps')
        .update({ attempts: newAttempts })
        .eq('email', user.email);

      throw new UnauthorizedException('Invalid OTP');
    }

    // OTP is valid - delete it
    await this.supabase.from('otps').delete().eq('email', user.email);

    // Generate JWT token
    const token = this.generateToken(user);

    return {
      message: 'Login successful',
      user: this.sanitizeUser(user),
      token,
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
      const token = this.generateToken(existingUser);
      return {
        message: 'Login successful',
        user: this.sanitizeUser(existingUser),
        token,
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

    const token = this.generateToken(newUser);

    return {
      message: 'User registered and logged in successfully',
      user: this.sanitizeUser(newUser),
      token,
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
      const token = this.generateToken(existingUser);
      return {
        message: 'Login successful',
        user: this.sanitizeUser(existingUser),
        token,
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

    const token = this.generateToken(newUser);

    return {
      message: 'User registered and logged in successfully',
      user: this.sanitizeUser(newUser),
      token,
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
        throw new UnauthorizedException(
          'Too many failed attempts. Please request a new OTP.',
        );
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
