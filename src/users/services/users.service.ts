import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../../database/supabase.provider';
import { Role } from '../../common/enums/role.enum';
import { User } from '../../common/interfaces/user.interface';
import { UpdateUserDto } from '../dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(@Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient) {}

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<Partial<User>> {
    const { data: user, error } = await this.supabase
      .from('users')
      .select('id, email, phone_number, first_name, last_name, role, age, gender, created_at')
      .eq('id', id)
      .single();

    if (error || !user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Find all users based on requester's role (RBAC filtering)
   */
  async findAll(requesterRole: Role): Promise<Partial<User>[]> {
    let allowedRoles: Role[] = [];

    if (requesterRole === Role.SuperAdmin) {
      // Super admin can see: admin, hospital, doctor, nurse, patient
      allowedRoles = [Role.Admin, Role.Hospital, Role.Doctor, Role.Nurse, Role.Patient];
    } else if (requesterRole === Role.Admin) {
      // Admin can see: hospital, doctor, nurse, patient
      allowedRoles = [Role.Hospital, Role.Doctor, Role.Nurse, Role.Patient];
    } else {
      // Other roles cannot list users
      return [];
    }

    const { data: users, error } = await this.supabase
      .from('users')
      .select('id, email, phone_number, first_name, last_name, role, age, gender, created_at')
      .in('role', allowedRoles)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error('Failed to fetch users');
    }

    return users || [];
  }

  /**
   * Find users by role (with RBAC filtering)
   */
  async findByRole(role: Role, requesterRole: Role): Promise<Partial<User>[]> {
    // Check if requester has permission to view this role
    let allowedRoles: Role[] = [];

    if (requesterRole === Role.SuperAdmin) {
      allowedRoles = [Role.Admin, Role.Hospital, Role.Doctor, Role.Nurse, Role.Patient];
    } else if (requesterRole === Role.Admin) {
      allowedRoles = [Role.Hospital, Role.Doctor, Role.Nurse, Role.Patient];
    }

    if (!allowedRoles.includes(role)) {
      // Requester does not have permission to view this role
      throw new Error('Forbidden: insufficient permissions to view users with this role');
    }

    const { data: users, error } = await this.supabase
      .from('users')
      .select('id, email, phone_number, first_name, last_name, role, age, gender, created_at')
      .eq('role', role)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error('Failed to fetch users');
    }

    return users || [];
  }

  /**
   * Get user statistics
   */
  async getStatistics(requesterRole: Role) {
    if (requesterRole !== Role.SuperAdmin && requesterRole !== Role.Admin) {
      throw new NotFoundException('Unauthorized to view statistics');
    }

    const { data: users, error } = await this.supabase
      .from('users')
      .select('role');

    if (error) {
      throw new Error('Failed to fetch statistics');
    }

    const stats = {
      total: users.length,
      byRole: {
        patient: users.filter((u) => u.role === Role.Patient).length,
        nurse: users.filter((u) => u.role === Role.Nurse).length,
        doctor: users.filter((u) => u.role === Role.Doctor).length,
        hospital: users.filter((u) => u.role === Role.Hospital).length,
        admin: users.filter((u) => u.role === Role.Admin).length,
        super_admin: users.filter((u) => u.role === Role.SuperAdmin).length,
      },
    };

    return stats;
  }

  /**
   * Update user profile for the given user id. Only allowed profile fields are updated.
   */
  async updateUser(userId: string, dto: UpdateUserDto): Promise<Partial<User>> {
    if (!userId) throw new BadRequestException('Missing user id');

    const allowed: any = {};
    if (dto.first_name !== undefined) allowed.first_name = dto.first_name;
    if (dto.last_name !== undefined) allowed.last_name = dto.last_name;
    if (dto.phone_number !== undefined) allowed.phone_number = dto.phone_number;
    if (dto.age !== undefined) allowed.age = dto.age;
    if (dto.gender !== undefined) allowed.gender = dto.gender;

    if (Object.keys(allowed).length === 0) {
      // Nothing to update — return current user
      const { data: user, error } = await this.supabase
        .from('users')
        .select('id, email, phone_number, first_name, last_name, role, age, gender, created_at')
        .eq('id', userId)
        .single();

      if (error || !user) throw new NotFoundException('User not found');
      return user;
    }

    const { data, error } = await this.supabase
      .from('users')
      .update(allowed)
      .eq('id', userId)
      .select('id, email, phone_number, first_name, last_name, role, age, gender, created_at')
      .single();

    if (error) {
      throw new BadRequestException(error.message || 'Failed to update user');
    }

    if (!data) throw new NotFoundException('User not found');
    return data;
  }
}
