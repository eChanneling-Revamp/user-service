import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { SupabaseAuthService } from '../src/infrastructure/supabase/supabase-auth.service';

describe('Auth Refresh (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SupabaseAuthService)
      .useValue({
        refreshWithRefreshToken: jest.fn().mockResolvedValue({
          access_token: 'new.access.token',
          refresh_token: 'new.refresh.token',
          expires_in: 3600,
        }),
      })
      .compile();

  app = moduleRef.createNestApplication();
  // enable cookie parsing so req.cookies is populated in controllers
  const cookieParser = require('cookie-parser');
  app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('refresh should call refreshWithRefreshToken and set cookies', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', ['supabase_refresh_token=old.refresh.token'])
      .expect(200);

    expect(res.body.session).toBeDefined();
    const cookiesHeader = res.headers['set-cookie'];
    const cookies = Array.isArray(cookiesHeader) ? cookiesHeader : (cookiesHeader ? [String(cookiesHeader)] : []);
    expect(cookies.some((c: string) => c.startsWith('supabase_access_token'))).toBeTruthy();
    expect(cookies.some((c: string) => c.startsWith('supabase_refresh_token'))).toBeTruthy();
  });
});
