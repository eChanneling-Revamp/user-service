import { Controller, Post, Body, Get, UseGuards, Query, Inject, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateUserUseCase } from '../../application/use-cases/create-user.use-case';
import { CreateUserDto } from '../../application/dto/create-user.dto';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { Request } from 'express';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    @Inject('IUserRepository') private readonly userRepository: any,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async register(@Body() dto: CreateUserDto) {
    const user = await this.createUserUseCase.execute(dto);
    // sanitize: never return passwordHash
    const { passwordHash, ...safeUser } = user as any;
    return { user: safeUser };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @UseGuards(SupabaseAuthGuard)
  async getProfile(@Req() req: Request) {
    const supaUser = (req as any).supabaseUser;
    if (!supaUser) return { user: null };
    // map supabase user to safe shape
    const safe = {
      id: supaUser.id,
      email: supaUser.email,
      phone: supaUser.phone,
      user_metadata: supaUser.user_metadata,
    };
    return { user: safe };
  }

  @Get()
  async list(@Query('page') page?: string, @Query('limit') limit?: string, @Query('q') q?: string) {
    try {
      const pageNum = page ? parseInt(page, 10) : 1;
      const limitNum = limit ? parseInt(limit, 10) : 20;
      const result = await this.userRepository.search({ q, page: pageNum, limit: limitNum });
      return result;
    } catch (err) {
      console.error('Error in GET /api/users', err);
      throw err;
    }
  }
}