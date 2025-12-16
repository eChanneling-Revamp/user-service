import { AuthController } from './controllers/auth.controller';

describe('AuthController (cookie-only refresh)', () => {
  let controller: any;
  const mockUser = { id: 'u1', email: 'a@b.com' };

  beforeEach(() => {
    const authService: any = {
      register: jest.fn().mockResolvedValue({ message: 'User registered successfully', user: mockUser, tokens: { accessToken: 'a', refreshToken: 'r' } }),
      loginWithEmail: jest.fn().mockResolvedValue({ message: 'Login successful', user: mockUser, tokens: { accessToken: 'a', refreshToken: 'r' } }),
      verifyOtp: jest.fn().mockResolvedValue({ message: 'Login successful', user: mockUser, tokens: { accessToken: 'a', refreshToken: 'r' } }),
      refresh: jest.fn().mockResolvedValue({ message: 'Token refreshed', tokens: { accessToken: 'a', refreshToken: 'r' } }),
      logout: jest.fn().mockResolvedValue({ message: 'Logged out' }),
    };

    controller = new AuthController(authService as any);
  });

  it('register sets refresh cookie and returns accessToken only', async () => {
    const res: any = { cookie: jest.fn() };
    const result = await controller.register({}, res as any);
    expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'r', expect.any(Object));
    expect(res.cookie).toHaveBeenCalledWith('csrf_token', expect.any(String), expect.any(Object));
    expect(result).toEqual({ message: 'User registered successfully', user: mockUser, accessToken: 'a' });
  });

  it('login sets refresh cookie and returns accessToken only', async () => {
    const res: any = { cookie: jest.fn() };
    const result = await controller.loginEmail({}, res as any);
    expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'r', expect.any(Object));
    expect(res.cookie).toHaveBeenCalledWith('csrf_token', expect.any(String), expect.any(Object));
    expect(result).toEqual({ message: 'Login successful', user: mockUser, accessToken: 'a' });
  });

  it('verifyOtp sets refresh cookie and returns accessToken only', async () => {
    const res: any = { cookie: jest.fn() };
    const result = await controller.verifyOtp({}, res as any);
    expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'r', expect.any(Object));
    expect(res.cookie).toHaveBeenCalledWith('csrf_token', expect.any(String), expect.any(Object));
    expect(result).toEqual({ message: 'Login successful', user: mockUser, accessToken: 'a' });
  });

  it('refresh uses cookie and sets new cookie and returns accessToken only', async () => {
    const req: any = { cookies: { refresh_token: 'r', csrf_token: 'c' }, headers: { 'x-csrf-token': 'c' } };
    const res: any = { cookie: jest.fn() };
    const result = await controller.refresh({}, req as any, res as any);
    expect(result).toEqual({ message: 'Token refreshed', accessToken: 'a' });
    expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'r', expect.any(Object));
    expect(res.cookie).toHaveBeenCalledWith('csrf_token', expect.any(String), expect.any(Object));
  });

  it('refresh rejects when CSRF header missing or invalid', async () => {
    const Csrf = require('./controllers/auth.controller').prototype; // noop to satisfy require cache
    const { CsrfGuard } = require('./guards/csrf.guard');
    const guard = new CsrfGuard();

    const ctx: any = {
      switchToHttp: () => ({
        getRequest: () => ({ cookies: { refresh_token: 'r', csrf_token: 'c' }, headers: {} }),
      }),
    };

    await expect(() => guard.canActivate(ctx as any)).toThrow();
  });

  it('logout clears cookie and returns message', async () => {
    const req: any = { cookies: { refresh_token: 'r', csrf_token: 'c' }, headers: { 'x-csrf-token': 'c' } };
    const res: any = { clearCookie: jest.fn() };
    const result = await controller.logout({}, req as any, res as any);
    expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', { path: '/' });
    expect(res.clearCookie).toHaveBeenCalledWith('csrf_token', { path: '/' });
    expect(result).toEqual({ message: 'Logged out' });
  });
});
