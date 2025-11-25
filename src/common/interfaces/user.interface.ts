import { Role } from '../enums/role.enum';

export interface User {
  id: string;
  email: string;
  nic?: string;
  phone_number?: string;
  first_name: string;
  last_name: string;
  role: Role;
  age?: number;
  gender?: string;
  created_at?: Date;
  updated_at?: Date;
}
