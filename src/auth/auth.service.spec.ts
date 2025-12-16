import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { AuthService } from './services/auth.service';

describe('AuthService - refresh flow', () => {
  let auth: AuthService;
  let supabase: any;
  let jwt: JwtService;
  let config: ConfigService;
  let mail: any;

  const makeSupabaseMock = (rows = []) => {
    return {
      from: (table: string) => ({
        select: (cols?: string) => ({ single: async () => ({ data: rows[0] || null }) }),
        insert: async (payload: any[]) => ({ data: payload[0], error: null }),
        upsert: async (payload: any) => ({ data: payload, error: null }),
        update: async (payload: any) => ({ data: payload, error: null }),
        delete: async () => ({ data: null }),
        order: function () { return { then: async () => rows } }
      })
    };
  };

  beforeEach(() => {
    supabase = makeSupabaseMock();
    jwt = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: '1h' } });
    config = { get: (k: string) => {
      if (k === 'jwt.secret') return 'test-secret';
      if (k === 'jwt.expiresIn') return '1h';
      if (k === 'jwt.refreshSecret') return 'refresh-secret';
      if (k === 'jwt.refreshExpiresIn') return '7d';
      return null;
    }} as any;
    mail = {} as any;

    auth = new AuthService(supabase, jwt as any, mail as any, config as any);
  });

  it('createAndStoreTokens returns tokens and stores hashed refresh', async () => {
    const user = { id: 'u1', email: 'a@b.com', role: 'patient' } as any;

    // replace supabase.from to capture insert
    const inserted: any[] = [];
    supabase.from = (table: string) => ({ insert: async (p: any[]) => { inserted.push(p[0]); return { data: p[0] }; } });

    const tokens = await auth.createAndStoreTokens(user as any);

    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();

    // ensure hashed token stored
    expect(inserted.length).toBe(1);
    const stored = inserted[0];
    expect(stored.user_id).toBe(user.id);
    expect(stored.token).toBeDefined();
    expect(stored.expires_at).toBeDefined();
    // hashed token should not equal raw refresh token
    expect(stored.token).not.toEqual(tokens.refreshToken);
    // hashed token should match when compared with bcrypt
    const isMatch = await bcrypt.compare(tokens.refreshToken, stored.token);
    expect(isMatch).toBe(true);
  }, 10000);

  it('logout revokes matching refresh token', async () => {
    // mock a row with hashed token
    const user = { id: 'u2', email: 'x@y.com', role: 'patient' } as any;
    const payload = { sub: user.id, email: user.email, role: user.role };
    const refreshJwt = jwt.sign(payload, { secret: 'refresh-secret', expiresIn: '7d' } as any as any);
    const hashed = await bcrypt.hash(refreshJwt, 10);

    supabase.from = (table: string) => ({
      select: async () => ({ data: [{ id: 'r1', user_id: user.id, token: hashed, revoked: false }] }),
      update: (payload: any) => ({
        eq: async (col: string, val: any) => ({ data: [{ ...payload }] }),
      }),
    });

    const result = await auth.logout({ refreshToken: refreshJwt } as any);
    expect(result).toEqual({ message: 'Logged out' });
  }, 10000);

  it('refresh rotates token and returns new tokens', async () => {
    const user = { id: 'u2', email: 'x@y.com', role: 'patient' } as any;
    const payload = { sub: user.id, email: user.email, role: user.role };
    const refreshJwt = jwt.sign(payload, { secret: 'refresh-secret', expiresIn: '7d' } as any as any);
    const hashed = await bcrypt.hash(refreshJwt, 10);

    // Simulate rows returned from refresh_tokens for matching user
    supabase.from = (table: string) => {
      if (table === 'users') {
        return {
          select: (cols?: string) => ({
            eq: (col: string, val: any) => ({ single: async () => ({ data: user }) })
          })
        } as any;
      }

      return {
        select: (cols?: string) => ({
          eq: (col: string, val: any) => ({
            order: (colName: string, opts?: any) => Promise.resolve({ data: [{ id: 'r1', user_id: user.id, token: hashed, revoked: false, expires_at: new Date(Date.now()+1000*60*60).toISOString() }] })
          })
        }),
        update: (payload: any) => ({ eq: async (col: string, val: any) => ({ data: payload }) }),
        insert: async (payload: any[]) => ({ data: payload[0] })
      } as any;
    };

    const result = await auth.refresh({ refreshToken: refreshJwt } as any);
    expect(result).toHaveProperty('tokens');
    expect(result.tokens.accessToken).toBeDefined();
    expect(result.tokens.refreshToken).toBeDefined();
  }, 20000);
});
