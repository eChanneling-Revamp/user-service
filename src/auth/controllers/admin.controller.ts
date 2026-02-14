import { Controller, Post, Body, UseGuards, Delete, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { AuthService } from '../services/auth.service';

@ApiTags('Authentication')
@Controller('auth/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuthAdminController {
  constructor(private readonly authService: AuthService) {}

  @Post('revoke-user')
  @Roles(Role.SuperAdmin, Role.Admin)
  @ApiOperation({ summary: 'Revoke all refresh tokens for a given user (admin only)' })
  @ApiResponse({ status: 200, description: 'Tokens revoked' })
  async revokeUserTokens(@Body() body: { userId: string }) {
    const userId = body.userId;
    return this.authService.revokeAllRefreshTokensForUser(userId);
  }

  @Delete('users/:id')
  @Roles(Role.SuperAdmin, Role.Admin)
  @ApiOperation({ summary: 'Delete a user (admin only)' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async deleteUser(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string; user: { id: string; email: string } }> {
    const result = await this.authService.deleteUser(id);
    return { message: 'User deleted successfully', user: result };
  }
}
