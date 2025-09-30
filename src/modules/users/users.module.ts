import { Module } from '@nestjs/common';
import { UsersController } from '../../presentation/controllers/users.controller';
import { CreateUserUseCase } from '../../application/use-cases/create-user.use-case';
import { UserService } from '../../domain/services/user.service';
import { AuthService } from '../../domain/services/auth.service';
import { SessionsRepository } from '../../infrastructure/supabase/sessions.repository';
import { AuthController } from '../../presentation/controllers/auth.controller';
import { SupabaseUserRepository } from './repositories/supabase-user.repository';
import { SupabaseModule } from '../../infrastructure/supabase/supabase.module';
import { IUserRepository } from '../../domain/interfaces/user.interface';

@Module({
  imports: [SupabaseModule],
  controllers: [UsersController, AuthController],
  providers: [
    CreateUserUseCase,
    UserService,
    AuthService,
    SessionsRepository,
    {
      provide: 'IUserRepository',
      useClass: SupabaseUserRepository,
    },
  ],
  exports: [UserService, CreateUserUseCase, AuthService],
})
export class UsersModule {}
