import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { ConfidentialClientApplication, AuthorizationUrlRequest } from '@azure/msal-node';

@Injectable()
export class AzureAdStrategy extends PassportStrategy(Strategy, 'azure-ad') {
  private msalClient: ConfidentialClientApplication;
  private redirectUri: string;

  constructor(private configService: ConfigService) {
    super();

    // Support multiple env var naming conventions used in .env
    this.redirectUri =
      configService.get<string>('AZURE_AD_CALLBACK_URL') ||
      configService.get<string>('AZURE_REDIRECT_URI') ||
      configService.get<string>('azure.callbackURL') ||
      configService.get<string>('azure.callbackUrl') ||
      '';

    const clientId =
      configService.get<string>('AZURE_AD_CLIENT_ID') ||
      configService.get<string>('AZURE_CLIENT_ID') ||
      configService.get<string>('azure.clientId') ||
      '';

    const tenantId =
      configService.get<string>('AZURE_AD_TENANT_ID') ||
      configService.get<string>('AZURE_TENANT') ||
      configService.get<string>('azure.tenantId') ||
      '';

    const clientSecret =
      configService.get<string>('AZURE_AD_CLIENT_SECRET') ||
      configService.get<string>('AZURE_CLIENT_SECRET') ||
      configService.get<string>('azure.clientSecret') ||
      '';

    const msalConfig = {
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        clientSecret,
      },
    };

    this.msalClient = new ConfidentialClientApplication(msalConfig);
  }

  async validate(req: any): Promise<any> {
    const { code } = req.query;

    if (!code) {
      throw new UnauthorizedException('Authorization code not found');
    }

    try {
      const tokenRequest = {
        code: code as string,
        scopes: ['user.read', 'openid', 'profile', 'email'],
        redirectUri: this.redirectUri,
      };

      const response = await this.msalClient.acquireTokenByCode(tokenRequest);

      if (!response || !response.account) {
        throw new UnauthorizedException('Failed to acquire token');
      }

      const user = {
        email: response.account.username,
        firstName: response.account.name?.split(' ')[0] || '',
        lastName: response.account.name?.split(' ').slice(1).join(' ') || '',
        azureId: response.account.homeAccountId,
      };

      return user;
    } catch (error) {
      throw new UnauthorizedException('Azure AD authentication failed');
    }
  }

  async getAuthorizationUrl(): Promise<string> {
    const authUrlRequest: AuthorizationUrlRequest = {
      scopes: ['user.read', 'openid', 'profile', 'email'],
      redirectUri: this.redirectUri,
    };

    return await this.msalClient.getAuthCodeUrl(authUrlRequest);
  }
}
