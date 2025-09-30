import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { OIDCStrategy } from 'passport-azure-ad';

@Injectable()
export class AzureStrategy extends PassportStrategy(OIDCStrategy, 'azure') {
  constructor() {
    super({
      identityMetadata: `https://login.microsoftonline.com/${process.env.AZURE_TENANT || 'common'}/v2.0/.well-known/openid-configuration`,
      clientID: process.env.AZURE_CLIENT_ID,
      clientSecret: process.env.AZURE_CLIENT_SECRET,
      responseType: 'code',
      responseMode: 'query',
      redirectUrl: process.env.AZURE_REDIRECT_URI,
      allowHttpForRedirectUrl: true,
      passReqToCallback: false,
      scope: ['profile', 'email', 'openid']
    });
  }

  async validate(profile: any, done: Function) {
    const user = {
      provider: 'azure',
      providerId: profile.oid || profile.sub,
      email: profile.upn || profile.email,
      name: profile.name,
    };
    done(null, user);
  }
}
