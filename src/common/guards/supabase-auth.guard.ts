import { CanActivate, ExecutionContext, Injectable, Inject } from '@nestjs/common';
import { Request } from 'express';
import { SUPABASE_PUBLIC, SUPABASE_SERVICE } from '../../infrastructure/supabase/supabase.providers';
import { SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    @Inject(SUPABASE_PUBLIC) private readonly anonClient: SupabaseClient,
    @Inject(SUPABASE_SERVICE) private readonly svcClient: SupabaseClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const auth = req.headers['authorization'] as string | undefined;
    let token: string | undefined;
    if (auth && auth.startsWith('Bearer ')) token = auth.slice('Bearer '.length);
    if (!token) {
      // try cookie
      token = req.cookies?.supabase_access_token as string | undefined;
    }
    if (!token) return false;

    try {
      const { data, error } = await this.anonClient.auth.getUser(token);
      if (error || !data?.user) return false;
      const supaUser = data.user;
      // fetch roles from users table using service client
      try {
        const { data: rows } = await this.svcClient.from('users').select('roles').eq('id', supaUser.id).maybeSingle();
        const roles = rows?.roles || supaUser.user_metadata?.roles || [];
        (req as any).supabaseUser = { ...supaUser, roles };
      } catch (e) {
        (req as any).supabaseUser = { ...supaUser, roles: supaUser.user_metadata?.roles || [] };
      }
      return true;
    } catch (e) {
      return false;
    }
  }
}
