// Active lightweight schema substitute — interface only to avoid mongoose dependency.
export interface User {
  id?: string;
  email: string;
  name?: string;
  phone?: string;
  passwordHash?: string;
  roles?: string[];
  isVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type UserDocument = User;