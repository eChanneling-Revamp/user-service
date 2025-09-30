import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { User } from '../entities/user.entity';
import { IUserRepository } from '../interfaces/user.interface';

@Injectable()
export class UserService {
  constructor(@Inject('IUserRepository') private readonly userRepository: IUserRepository) {}

  async createUser(email: string, name?: string, phone?: string, password?: string): Promise<User> {
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new BadRequestException('User already exists');
    }

    let passwordHash: string | undefined = undefined;
    if (password) {
      // bcrypt default salt rounds 10
      passwordHash = await bcrypt.hash(password, 10);
    }

    const userData: any = {
      email,
      name,
      phone,
      passwordHash,
      roles: ['user'],
      isVerified: false,
    };

    const createdUser = await this.userRepository.create(userData);
    return new User(
      createdUser._id || createdUser.id,
      createdUser.email,
      createdUser.name,
      createdUser.phone,
      createdUser.roles,
      createdUser.isVerified,
      createdUser.createdAt,
      createdUser.updatedAt
    );
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) return null;

    return new User(
      user._id || user.id,
      user.email,
      user.name,
      user.phone,
      user.roles,
      user.isVerified,
      user.createdAt,
      user.updatedAt
    );
  }
}