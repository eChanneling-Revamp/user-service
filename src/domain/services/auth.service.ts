import { Inject, Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { IUserRepository } from '../interfaces/user.interface';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn = '15m';
  private readonly refreshExpiresIn = '7d';

  constructor(@Inject('IUserRepository') private readonly userRepository: IUserRepository) {
    this.jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-me';
  }

  async verifyPassword(plain: string, hash: string) {
    return bcrypt.compare(plain, hash);
  }

  signTokens(payload: object): Tokens {
    const accessToken = jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiresIn });
    const refreshToken = jwt.sign(payload, this.jwtSecret, { expiresIn: this.refreshExpiresIn });
    return { accessToken, refreshToken };
  }

  verifyToken<T = any>(token: string): T {
    return jwt.verify(token, this.jwtSecret) as T;
  }
}
