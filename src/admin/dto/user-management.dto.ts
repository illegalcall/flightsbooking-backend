import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { UserRole } from '@prisma/client';
import { AdminPaginationDto } from './admin-pagination.dto';
import { AdminResponseDto } from './admin-response.dto';

export class UpdateUserRoleDto {
  @ApiProperty({
    description: 'New role to assign to the user',
    enum: UserRole,
    example: UserRole.ADMIN,
  })
  @IsEnum(UserRole)
  role: UserRole;
}

export class UserFilterDto extends AdminPaginationDto {
  @ApiProperty({
    description: 'Filter users by role',
    enum: UserRole,
    required: false,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiProperty({
    description: 'Search users by name or email',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class UserListResponseDto extends AdminResponseDto {
  @ApiProperty({
    description: 'List of users',
    type: 'array',
  })
  data: {
    id: string;
    userId: string;
    fullName: string;
    email: string;
    role: UserRole;
    createdAt: Date;
    updatedAt: Date;
    bookingsCount: number;
  }[];

  @ApiProperty({
    description: 'Total number of users matching the filter',
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
  })
  limit: number;
}
