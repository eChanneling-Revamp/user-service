import { Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_SERVICE } from './supabase.providers';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class SessionsRepository {
  constructor(@Inject(SUPABASE_SERVICE) private readonly supabase: SupabaseClient) {}

  async storeRefreshToken(userId: string, refreshToken: string, expiresAt: string) {
    const hashed = await bcrypt.hash(refreshToken, 10);
    const { error } = await this.supabase.from('sessions').insert({ user_id: userId, refresh_token: hashed, expires_at: expiresAt });
    if (error) throw error;
  }

  async verifyRefreshToken(userId: string, refreshToken: string) {
    const { data, error } = await this.supabase.from('sessions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1);
    if (error) throw error;
    if (!data || data.length === 0) return false;
    const row = data[0] as any;
    const ok = await bcrypt.compare(refreshToken, row.refresh_token);
    return ok ? row : false;
  }

  async deleteSessionsForUser(userId: string) {
    const { error } = await this.supabase.from('sessions').delete().eq('user_id', userId);
    if (error) throw error;
  }
}
