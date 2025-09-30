import { Injectable, Inject } from '@nestjs/common';
import { IUserRepository } from '../../domain/interfaces/user.interface';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(@Inject('IUserRepository') private userRepository: IUserRepository) {}

  async findByEmail(email: string) {
    return this.userRepository.findByEmail(email);
  }

  async create(dto: CreateUserDto) {
    const data: any = { ...dto };
    return this.userRepository.create(data);
  }
}
