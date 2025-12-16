import { RefreshTokenCleanupService } from '../services/refresh-cleanup.service';

describe('RefreshTokenCleanupService', () => {
  it('calls supabase delete with correct filter', async () => {
    let deleted = false;
    const supabase = {
      from: (table: string) => ({
        delete: () => ({
          lt: (col: string, val: any) => {
            if (table === 'refresh_tokens' && col === 'expires_at') deleted = true;
            return Promise.resolve({ error: null });
          },
        }),
      }),
    } as any;

    const config = { get: (k: string) => 1 } as any; // intervalMinutes=1
    const svc = new RefreshTokenCleanupService(supabase as any, config as any);

    const res = await svc.cleanupNow();
    expect(res).toEqual({ message: 'cleanup completed' });
    expect(deleted).toBe(true);
  });
});
