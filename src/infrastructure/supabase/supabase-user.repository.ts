import { Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLIC, SUPABASE_SERVICE } from './supabase.providers';
import { IUserRepository } from '../../domain/interfaces/user.interface';

@Injectable()
export class SupabaseUserRepository implements IUserRepository {
  constructor(
    @Inject(SUPABASE_SERVICE) private readonly svcClient: SupabaseClient,
    @Inject(SUPABASE_PUBLIC) private readonly anonClient: SupabaseClient,
  ) {}

  private toDb(obj: any) {
    // Map domain/camelCase keys to DB/snake_case columns
    const out: any = {};
    if (obj.email !== undefined) out.email = obj.email;
    if (obj.name !== undefined) out.name = obj.name;
    if (obj.phone !== undefined) out.phone = obj.phone;
    if (obj.passwordHash !== undefined) out.password_hash = obj.passwordHash;
    if (obj.roles !== undefined) out.roles = obj.roles;
    if (obj.isVerified !== undefined) out.is_verified = obj.isVerified;
    if (obj.createdAt !== undefined) out.created_at = obj.createdAt;
    if (obj.updatedAt !== undefined) out.updated_at = obj.updatedAt;
    return out;
  }

  private fromDb(row: any) {
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      phone: row.phone,
      passwordHash: row.password_hash,
      roles: row.roles,
      isVerified: row.is_verified,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findById(id: string) {
    try {
      const { data, error } = await this.svcClient.from('users').select('*').eq('id', id).maybeSingle();
      if (error) return null;
      return this.fromDb(data) || null;
    } catch (err: any) {
      if (String(err.message).includes("Could not find the table 'public.users'")) {
        throw new Error("Supabase table 'users' not found. Run db/create_users_table.sql in your Supabase SQL editor.");
      }
      throw err;
    }
  }

  async findByEmail(email: string) {
    const { data, error } = await this.svcClient.from('users').select('*').eq('email', email).maybeSingle();
    if (error) return null;
    return this.fromDb(data) || null;
  }

  async create(data: any) {
    // Convert domain object to DB columns (snake_case)
    const dbRow = this.toDb(data);
    const { data: created, error } = await this.svcClient.from('users').insert([dbRow]).select().single();
    if (error) throw error;
    return this.fromDb(created);
  }

  async update(id: string, data: any) {
    const dbRow = this.toDb(data);
    const { data: updated, error } = await this.svcClient.from('users').update(dbRow).eq('id', id).select().single();
    if (error) throw error;
    return this.fromDb(updated);
  }

  async delete(id: string) {
    const { error } = await this.svcClient.from('users').delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  async search(query: { q?: string; page?: number; limit?: number }) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const offset = (page - 1) * limit;

    let builder = this.svcClient.from('users').select('*', { count: 'exact' });
    if (query.q) {
      const ilike = `%${query.q.replace('%', '')}%`;
      builder = builder.or(`email.ilike.${ilike},name.ilike.${ilike}`);
    }

    const { data, error, count } = await builder.range(offset, offset + limit - 1);
    if (error) throw error;

    const items = (data || []).map((r: any) => this.fromDb(r));
    return { items, total: typeof count === 'number' ? count : items.length, page, limit };
  }
}
