import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_PUBLIC = 'SUPABASE_PUBLIC';
export const SUPABASE_SERVICE = 'SUPABASE_SERVICE';

export const createSupabaseProviders = (): Provider[] => [
  {
    provide: SUPABASE_PUBLIC,
    useFactory: (config: ConfigService): SupabaseClient => {
      const url = config.get<string>('SUPABASE_URL');
      const anonKey = config.get<string>('SUPABASE_ANON_KEY') || config.get<string>('SUPABASE_KEY');
      if (!url || !anonKey) {
        throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_KEY) must be set');
      }
      return createClient(url, anonKey, { auth: { persistSession: false } });
    },
    inject: [ConfigService],
  },
  {
    provide: SUPABASE_SERVICE,
    useFactory: (config: ConfigService): SupabaseClient => {
      const url = config.get<string>('SUPABASE_URL');
      const serviceKey = config.get<string>('SUPABASE_SERVICE_ROLE_KEY') || config.get<string>('SUPABASE_SERVICE_KEY') || config.get<string>('SUPABASE_KEY');
      if (!url || !serviceKey) {
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY) must be set');
      }
      return createClient(url, serviceKey);
    },
    inject: [ConfigService],
  },
];
