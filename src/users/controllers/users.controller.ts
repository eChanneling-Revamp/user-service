import { Controller, Get, UseGuards, Param, ForbiddenException, BadRequestException, Put, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from '../services/users.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { Role } from '../../common/enums/role.enum';
import { UpdateUserDto } from '../dto/update-user.dto';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyProfile(@GetUser() user: any) {
    return this.usersService.findById(user.id);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'User profile updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateMyProfile(@GetUser() user: any, @Body() dto: UpdateUserDto) {
    const userId = user?.id || user?.sub || user?.userId;
    if (!userId) {
      throw new BadRequestException('Unable to determine user id from token');
    }

    return this.usersService.updateUser(userId, dto);
  }

  @Get()
  @Roles(Role.Admin, Role.SuperAdmin)
  @ApiOperation({ 
    summary: 'List all users (Admin/SuperAdmin only)',
    description: 'SuperAdmin can see: admin, hospital, doctor, nurse, patient. Admin can see: hospital, doctor, nurse, patient.'
  })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async getAllUsers(@GetUser() user: any) {
    return this.usersService.findAll(user.role);
  }

  @Get('role/:role')
  @Roles(Role.Admin, Role.SuperAdmin)
  @ApiOperation({ 
    summary: 'Get users by role (Admin/SuperAdmin only)',
    description: 'Filter users by specific role. Access depends on requester permissions.'
  })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async getUsersByRole(@Param('role') roleParam: string, @GetUser() user: any) {
    // Validate role parameter
    const roleValues = Object.values(Role) as string[];
    if (!roleValues.includes(roleParam)) {
      return {
        statusCode: 400,
        message: `Invalid role parameter. Valid roles: ${roleValues.join(', ')}`,
      };
    }

    const role = roleParam as Role;

    try {
      return await this.usersService.findByRole(role, user.role);
    } catch (err) {
      if (err.message && err.message.startsWith('Forbidden')) {
        throw new ForbiddenException('Forbidden - insufficient permissions');
      }
      throw err;
    }
  }

  @Get('statistics')
  @Roles(Role.Admin, Role.SuperAdmin)
  @ApiOperation({ 
    summary: 'Get user statistics (Admin/SuperAdmin only)',
    description: 'Returns count of users by role and total user count.'
  })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async getStatistics(@GetUser() user: any) {
    return this.usersService.getStatistics(user.role);
  }
}
