import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  Res,
  Delete,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../services/auth.service';
import { RegisterUserDto } from '../dto/register-user.dto';
import { LoginEmailDto } from '../dto/login-email.dto';
import { SendOtpDto } from '../dto/send-otp.dto';
import { VerifyOtpDto } from '../dto/verify-otp.dto';
import { RequestPasswordResetDto } from '../dto/request-password-reset.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { Public } from '../../common/decorators/public.decorator';
import { GoogleAuthGuard } from '../guards/google-auth.guard';
import { AzureAuthGuard } from '../guards/azure-auth.guard';
import { Request, Response as ExpressResponse } from 'express';
import { CsrfGuard } from '../guards/csrf.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async register(
    @Body() registerDto: RegisterUserDto,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    const result = await this.authService.register(registerDto);
    // Set refresh token in secure httpOnly cookie if present
    if (result.tokens?.refreshToken) {
      res.cookie('refresh_token', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days (match refresh expiry)
      });
      // Set a non-httpOnly CSRF cookie for double-submit protection
      const csrf = require('crypto').randomBytes(16).toString('hex');
      res.cookie('csrf_token', csrf, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 7,
      });
    }

    // Return access token and user but do not expose refresh token in the body
    return {
      message: result.message,
      user: result.user,
      accessToken: result.tokens?.accessToken,
    };
  }

  @Public()
  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiBody({
    description: 'Refresh token body - accepts `refreshToken` or `refresh_token`',
    type: RefreshTokenDto,
    examples: {
      camelCase: { summary: 'camelCase', value: { refreshToken: 'eyJ...' } },
      snake_case: { summary: 'snake_case', value: { refresh_token: 'eyJ...' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Token refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  @UseGuards(CsrfGuard)
  async refresh(
    @Body() refreshDto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    // Prefer cookie if refreshToken not provided in body
    if (!refreshDto.refreshToken) {
      refreshDto.refreshToken = (req as any).cookies?.refresh_token;
    }

    const result = await this.authService.refresh(refreshDto);

    if (result.tokens?.refreshToken) {
      res.cookie('refresh_token', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 7,
      });
      // rotate csrf token
      const csrf = require('crypto').randomBytes(16).toString('hex');
      res.cookie('csrf_token', csrf, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 7,
      });
    }

    return { message: result.message, accessToken: result.tokens?.accessToken };
  }

  @Public()
  @Post('logout')
  @UseGuards(CsrfGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  @ApiBody({
    description: 'Refresh token body - accepts `refreshToken` or `refresh_token`',
    type: RefreshTokenDto,
    examples: {
      camelCase: { summary: 'camelCase', value: { refreshToken: 'eyJ...' } },
      snake_case: { summary: 'snake_case', value: { refresh_token: 'eyJ...' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Logged out' })
  async logout(
    @Body() refreshDto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    // Accept cookie if body not provided
    if (!refreshDto.refreshToken) {
      refreshDto.refreshToken = (req as any).cookies?.refresh_token;
    }

    const result = await this.authService.logout(refreshDto);

    // Clear cookie
    res.clearCookie('refresh_token', { path: '/' });
    res.clearCookie('csrf_token', { path: '/' });

    return result;
  }

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @ApiOperation({ summary: 'Login with email and password (Web)' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async loginEmail(
    @Body() loginDto: LoginEmailDto,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    const result = await this.authService.loginWithEmail(loginDto);

    if (result.tokens?.refreshToken) {
      res.cookie('refresh_token', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 7,
      });
      // Set csrf token cookie
      const csrf = require('crypto').randomBytes(16).toString('hex');
      res.cookie('csrf_token', csrf, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 7,
      });
    }

    return {
      message: result.message,
      user: result.user,
      accessToken: result.tokens?.accessToken,
    };
  }

  @Public()
  @Post('send-otp')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 requests per minute
  @ApiOperation({ summary: 'Send OTP to registered email for mobile login' })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  @ApiResponse({ status: 400, description: 'User not found' })
  @ApiResponse({ status: 429, description: 'Too many requests - please wait' })
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.authService.sendOtp(sendOtpDto);
  }

  @Public()
  @Post('verify-otp')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @ApiOperation({ summary: 'Verify OTP and login (Mobile)' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid or expired OTP' })
  async verifyOtp(
    @Body() verifyOtpDto: VerifyOtpDto,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    const result = await this.authService.verifyOtp(verifyOtpDto);

    if (result.tokens?.refreshToken) {
      res.cookie('refresh_token', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 7,
      });
      // Set csrf token cookie
      const csrf = require('crypto').randomBytes(16).toString('hex');
      res.cookie('csrf_token', csrf, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 7,
      });
    }

    return {
      message: result.message,
      user: result.user,
      accessToken: result.tokens?.accessToken,
    };
  }

  @Public()
  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 requests per minute
  @ApiOperation({ summary: 'Request password reset - sends OTP to email' })
  @ApiResponse({ status: 200, description: 'Password reset OTP sent successfully' })
  @ApiResponse({ status: 429, description: 'Too many requests - please wait' })
  async forgotPassword(@Body() requestResetDto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(requestResetDto.email);
  }

  @Public()
  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @ApiOperation({ summary: 'Reset password using OTP verification' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - passwords do not match' })
  @ApiResponse({ status: 401, description: 'Invalid or expired OTP' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Public()
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  async googleAuth() {
    // Guard redirects to Google
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleAuthCallback(@Req() req: Request, @Res() res: ExpressResponse) {
    const result = await this.authService.handleGoogleLogin(req.user);

    // Set refresh token cookie if present
    if (result.tokens?.refreshToken) {
      res.cookie('refresh_token', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 7,
      });
    }

    // Redirect to frontend with access token only
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}/auth/callback?token=${result.tokens?.accessToken || ''}`);
  }

  @Public()
  @Get('google/url')
  @ApiOperation({ summary: 'Get Google auth URL' })
  getGoogleUrl() {
    const url = this.authService.getGoogleAuthUrl();
    return { url };
  }

  @Public()
  @Get('azure')
  @ApiOperation({ summary: 'Initiate Azure AD OAuth login' })
  async azureAuth(@Res() res: ExpressResponse) {
    const authService = this.authService as any;
    const authUrl = authService.getAzureAuthUrl();

    if (!authUrl) {
      // Return a clear JSON error so clients (or Swagger UI) don't try to follow an empty redirect
      return res.status(400).json({
        statusCode: 400,
        message:
          'Azure AD OAuth is not configured on the server. Please set AZURE_AD_CLIENT_ID, AZURE_AD_TENANT_ID and AZURE_AD_CALLBACK_URL in environment.',
      });
    }

    return res.redirect(authUrl);
  }

  @Public()
  @Get('azure/url')
  @ApiOperation({ summary: 'Get Azure auth URL' })
  getAzureUrl() {
    const authService = this.authService as any;
    const url = authService.getAzureAuthUrl();
    return { url };
  }

  @Public()
  @Get('azure/callback')
  @UseGuards(AzureAuthGuard)
  @ApiOperation({ summary: 'Azure AD OAuth callback' })
  async azureAuthCallback(@Req() req: Request, @Res() res: ExpressResponse) {
    const result = await this.authService.handleAzureLogin(req.user);
    // Set refresh token cookie if present
    if (result.tokens?.refreshToken) {
      res.cookie('refresh_token', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 7,
      });
    }

    // Redirect to frontend with access token only
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}/auth/callback?token=${result.tokens?.accessToken || ''}`);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('users/me')
  @ApiOperation({ summary: 'Delete own account' })
  @ApiResponse({ status: 200, description: 'Account deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async deleteOwnAccount(
    @Req() req: Request,
  ): Promise<{ message: string; user: { id: string; email: string } }> {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    const result = await this.authService.deleteUser(userId);
    return { message: 'Account deleted successfully', user: result };
  }
}
