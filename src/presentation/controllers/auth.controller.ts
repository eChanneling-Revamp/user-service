import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Req, Res } from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from '../../domain/services/auth.service';
import { IUserRepository } from '../../domain/interfaces/user.interface';
import { SessionsRepository } from '../../infrastructure/supabase/sessions.repository';
import { SupabaseAuthService } from '../../infrastructure/supabase/supabase-auth.service';

class LoginDto {
  email!: string;
  password!: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject('IUserRepository') private readonly userRepository: IUserRepository,
    private readonly sessionsRepo: SessionsRepository,
    private readonly supabaseAuth: SupabaseAuthService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    // Use Supabase to authenticate the user (anon client)
    const supa = await this.supabaseAuth.signIn(dto.email, dto.password).catch((e) => {
      return { error: e } as any;
    });

    if (!supa || (supa as any).error) {
      return { message: 'Invalid credentials' };
    }

    const supaUser = (supa as any).user || (supa as any).data?.user;
    if (!supaUser) return { message: 'Invalid credentials' };

    // Ensure we have a user profile in our users table
    let user = await this.userRepository.findByEmail(supaUser.email);
    if (!user) {
      const created = await this.userRepository.create({
        id: supaUser.id,
        email: supaUser.email,
        name: supaUser.user_metadata?.full_name || null,
        roles: ['user'],
      });
      user = created;
    }

    // Supabase returns session info including access_token and refresh_token
    const session = (supa as any).data?.session || (supa as any).session || null;
    // Optionally set cookies with Supabase session tokens for browser flows
    if (session) {
      res.cookie('supabase_access_token', session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: session.expires_in ? session.expires_in * 1000 : undefined,
      });
      res.cookie('supabase_refresh_token', session.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
    }

    return { session };
  }

  // register with Supabase auth and create profile in users table
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: { email: string; password: string; fullName?: string }, @Res({ passthrough: true }) res: Response) {
    const { email, password, fullName } = dto;
    const result = await this.supabaseAuth.signUp(email, password, fullName).catch((e) => ({ error: e }));
    if (!result || (result as any).error) {
      return { message: 'Registration failed' };
    }

    const userInfo = (result as any).user || (result as any).data?.user;
    if (!userInfo) return { message: 'Registration failed' };

    // create profile (if not created by signUp helper)
    let user = await this.userRepository.findByEmail(email);
    if (!user) {
      user = await this.userRepository.create({ id: userInfo.id, email, name: fullName || null, roles: ['user'] });
    }

    // After signup, Supabase may return a session; return it to the client
    const session = (result as any).data?.session || (result as any).session || null;
    if (session) {
      res.cookie('supabase_access_token', session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: session.expires_in ? session.expires_in * 1000 : undefined,
      });
      res.cookie('supabase_refresh_token', session.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
    }

    return { session };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.supabase_refresh_token as string | undefined;
    if (!refreshToken) return { status: 400, message: 'No refresh token' };

    try {
      const newSession = await this.supabaseAuth.refreshWithRefreshToken(refreshToken);
      // newSession contains access_token, refresh_token, expires_in, etc.
      if (newSession?.access_token) {
        res.cookie('supabase_access_token', newSession.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: newSession.expires_in ? newSession.expires_in * 1000 : undefined,
        });
      }
      if (newSession?.refresh_token) {
        res.cookie('supabase_refresh_token', newSession.refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
        });
      }
      return { session: newSession };
    } catch (err: any) {
      return { status: 401, message: 'Unable to refresh session', details: err?.message || err };
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Use Supabase signOut via anon client — this will clear server-side session for the token
    // The Supabase JS client signs out the current session; on server, use anon client to delete
    // cookies and tell the client to also clear its SDK state.
    try {
      await this.supabaseAuth.signOut();
    } catch (e) {
      // ignore
    }
    res.clearCookie('supabase_access_token', { path: '/' });
    res.clearCookie('supabase_refresh_token', { path: '/' });
    return { ok: true };
  }
}
