import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SUPABASE_CLIENT } from '../../database/supabase.provider';
import { SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class RefreshTokenCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RefreshTokenCleanupService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    const enabled = this.configService.get<boolean>('refresh.cleanupEnabled') ?? true;
    const intervalMinutes = this.configService.get<number>('refresh.cleanupIntervalMinutes') ?? 30;

    if (!enabled) {
      this.logger.log('Refresh token cleanup is disabled by configuration');
      return;
    }

    // Run immediately once, then schedule
    this.cleanupNow().catch((err) => this.logger.error('Initial cleanup failed', err));

    this.timer = setInterval(() => {
      this.cleanupNow().catch((err) => this.logger.error('Scheduled cleanup failed', err));
    }, intervalMinutes * 60 * 1000);

    this.logger.log(`Refresh token cleanup scheduled every ${intervalMinutes} minutes`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async cleanupNow() {
    this.logger.debug('Running refresh token cleanup');
    const now = new Date().toISOString();
    const { error } = await this.supabase.from('refresh_tokens').delete().lt('expires_at', now);
    if (error) {
      this.logger.error('Failed to delete expired refresh tokens', error);
      throw error;
    }
    this.logger.log('Expired refresh tokens cleanup completed');
    return { message: 'cleanup completed' };
  }
}
