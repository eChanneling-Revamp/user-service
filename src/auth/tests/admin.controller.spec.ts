import { AuthService } from '../services/auth.service';

describe('AuthAdminController (integration)', () => {
  it('calls revokeAllRefreshTokensForUser', async () => {
    try {
      const authService = { revokeAllRefreshTokensForUser: jest.fn().mockResolvedValue({ message: 'ok' }) } as any;
      const controllerModule = require('../controllers/admin.controller');
      const ctrl = new controllerModule.AuthAdminController(authService);

      const res = await ctrl.revokeUserTokens({ userId: 'u1' });
      expect(authService.revokeAllRefreshTokensForUser).toHaveBeenCalledWith('u1');
      expect(res).toEqual({ message: 'ok' });
    } catch (err) {
      console.error('TEST ERROR', err);
      throw err;
    }
  });
});
