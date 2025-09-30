import { Controller, Get, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('google')
  async googleRedirect(@Res() res: any) {
    // in a real app, redirect to Google authorization URL constructed server-side
    const url = this.authService.getGoogleAuthUrl();
    return res.redirect(url);
  }

  @Get('google/callback')
  async googleCallback(@Req() req: any, @Res() res: any) {
    const result = await this.authService.handleGoogleCallback(req.query);
    // redirect to frontend with result or set cookie
    return res.redirect(result.redirectUrl || '/');
  }

  @Get('azure')
  async azureRedirect(@Res() res: any) {
    const url = this.authService.getAzureAuthUrl();
    return res.redirect(url);
  }

  @Get('azure/callback')
  async azureCallback(@Req() req: any, @Res() res: any) {
    const result = await this.authService.handleAzureCallback(req.query);
    return res.redirect(result.redirectUrl || '/');
  }
}
