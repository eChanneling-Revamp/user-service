export enum Role {
  Patient = 'patient',
  Nurse = 'nurse',
  Doctor = 'doctor',
  Hospital = 'hospital',
  Admin = 'admin',
  SuperAdmin = 'super_admin',
}

export const RESTRICTED_ROLES = [Role.Admin, Role.SuperAdmin];
