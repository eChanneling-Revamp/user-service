import { Injectable } from '@nestjs/common';
import { CreateUserDto } from '../dto/create-user.dto';
import { UserService } from '../../domain/services/user.service';

@Injectable()
export class CreateUserUseCase {
  constructor(private readonly userService: UserService) {}

  async execute(dto: CreateUserDto) {
    return this.userService.createUser(dto.email, dto.name, dto.phone, dto.password);
  }
}