import { Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLIC, SUPABASE_SERVICE } from './supabase.providers';

@Injectable()
export class SupabaseAuthService {
  constructor(
    @Inject(SUPABASE_SERVICE) private readonly svcClient: SupabaseClient,
    @Inject(SUPABASE_PUBLIC) private readonly anonClient: SupabaseClient,
  ) {}

  async signIn(email: string, password: string) {
    const { data, error } = await this.anonClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async signUp(email: string, password: string, fullName?: string, redirectTo?: string) {
    const options: any = {
      data: {
        full_name: fullName || null,
        first_name: fullName ? fullName.split(' ')[0] : null,
        last_name: fullName ? fullName.split(' ').slice(1).join(' ') || null : null,
      },
    };
    if (redirectTo) options.emailRedirectTo = redirectTo;

    const { data, error } = await this.anonClient.auth.signUp({ email, password, options });
    if (error) throw error;

    // Create a profile row in `users` table (service key)
    try {
      const profile = {
        id: (data.user as any)?.id,
        email,
        name: fullName || null,
      };
      await this.svcClient.from('users').insert([profile]).select();
    } catch (e) {
      // non-fatal: profile creation failure shouldn't block signUp success
    }

    return data;
  }

  async resetPassword(email: string, redirectTo?: string) {
    const { error } = await this.anonClient.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
    return { ok: true };
  }

  async updateUser(password?: string, attrs?: Record<string, any>) {
    // Note: this method requires the client to be authenticated (access token)
    const payload: any = {};
    if (password) payload.password = password;
    if (attrs) payload.user_metadata = attrs;
    const { data, error } = await this.anonClient.auth.updateUser(payload);
    if (error) throw error;
    return data;
  }

  async getSession() {
    const { data, error } = await this.anonClient.auth.getSession();
    if (error) throw error;
    return data;
  }

  async getUser() {
    const { data, error } = await this.anonClient.auth.getUser();
    if (error) throw error;
    return data;
  }

  async signOut() {
    // The anon client signs out the current session (if client-side). On server we can
    // call signOut without token to attempt to clear cookies in a browser flow.
    try {
      await this.anonClient.auth.signOut();
    } catch (e) {
      // ignore
    }
    return { ok: true };
  }

  async refreshWithRefreshToken(refreshToken: string) {
    // Exchange a refresh token for a new session using the service role key via REST.
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
    if (!supabaseUrl || !serviceKey) throw new Error('SUPABASE_URL and service key are required to refresh token server-side');

    const url = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=refresh_token`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: `refresh_token=${encodeURIComponent(refreshToken)}`,
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error || 'Failed to refresh session');
    return body;
  }

  // Admin utilities (service role client)
  async adminGetUserById(id: string) {
    const { data, error } = await this.svcClient.auth.admin.getUserById(id);
    if (error) throw error;
    return data;
  }

  async adminCreateUser(payload: { email: string; password?: string; user_metadata?: Record<string, any> }) {
    const { data, error } = await this.svcClient.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      user_metadata: payload.user_metadata,
    });
    if (error) throw error;
    return data;
  }
}
