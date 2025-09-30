import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_REDIRECT_URI,
      scope: ['email', 'profile']
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any, done: Function) {
    // Map and return user info. In full impl, create or update user in DB
    const user = {
      provider: 'google',
      providerId: profile.id,
      email: profile.emails && profile.emails[0] && profile.emails[0].value,
      name: profile.displayName,
    };
    done(null, user);
  }
}
