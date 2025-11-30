import { Role, RESTRICTED_ROLES } from './role.enum';

describe('Role Enum', () => {
  it('should have correct values', () => {
    expect(Role.Patient).toBe('patient');
    expect(Role.Admin).toBe('admin');
  });

  it('should define restricted roles', () => {
    expect(RESTRICTED_ROLES).toContain(Role.Admin);
    expect(RESTRICTED_ROLES).toContain(Role.SuperAdmin);
    expect(RESTRICTED_ROLES).not.toContain(Role.Patient);
  });
});
