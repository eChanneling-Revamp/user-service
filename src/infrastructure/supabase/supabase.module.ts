import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { createSupabaseProviders } from './supabase.providers';
import { SupabaseAuthService } from './supabase-auth.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [...createSupabaseProviders(), SupabaseAuthService],
  exports: ['SUPABASE_PUBLIC', 'SUPABASE_SERVICE', SupabaseAuthService],
})
export class SupabaseModule {}
