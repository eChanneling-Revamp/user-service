import { Controller, Post, Body, Get, UseGuards, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
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
import { Request, Response } from 'express';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async register(@Body() registerDto: RegisterUserDto) {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @ApiOperation({ summary: 'Login with email and password (Web)' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async loginEmail(@Body() loginDto: LoginEmailDto) {
    return this.authService.loginWithEmail(loginDto);
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
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtpDto);
  }

  @Public()
  @Post('refresh')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Tokens refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refreshTokens(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshTokens(refreshTokenDto);
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
  async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
    const result = await this.authService.handleGoogleLogin(req.user);

    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}/auth/callback?token=${result.accessToken}&refreshToken=${result.refreshToken}`);
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
  async azureAuth(@Res() res: Response) {
    const authService = this.authService as any;
    const authUrl = authService.getAzureAuthUrl();

    if (!authUrl) {
      // Return a clear JSON error so clients (or Swagger UI) don't try to follow an empty redirect
      return res.status(400).json({
        statusCode: 400,
        message: 'Azure AD OAuth is not configured on the server. Please set AZURE_AD_CLIENT_ID, AZURE_AD_TENANT_ID and AZURE_AD_CALLBACK_URL in environment.',
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
  async azureAuthCallback(@Req() req: Request, @Res() res: Response) {
    const result = await this.authService.handleAzureLogin(req.user);

    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    res.redirect(`${frontendUrl}/auth/callback?token=${result.accessToken}&refreshToken=${result.refreshToken}`);
  }
}
