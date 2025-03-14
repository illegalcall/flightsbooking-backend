import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserProfileDto } from './dto/create-user-profile.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UserProfile } from '@prisma/client';

@Injectable()
export class UserProfileService {
  private readonly logger = new Logger(UserProfileService.name);

  constructor(private prisma: PrismaService) {}

  async create(
    createUserProfileDto: CreateUserProfileDto,
  ): Promise<UserProfile> {
    try {
      const userProfile = await this.prisma.userProfile.create({
        data: createUserProfileDto,
      });
      this.logger.log(`Created user profile with ID: ${userProfile.id}`);
      return userProfile;
    } catch (error) {
      this.logger.error(
        `Error creating user profile: ${error.message}`,
        error.stack,
      );

      if (error.code === 'P2002') {
        throw new ConflictException(
          'User profile with this email or userId already exists',
        );
      }

      throw error;
    }
  }

  async findAll(): Promise<UserProfile[]> {
    return this.prisma.userProfile.findMany();
  }

  async findOne(id: string): Promise<UserProfile> {
    const userProfile = await this.prisma.userProfile.findUnique({
      where: { id },
    });

    if (!userProfile) {
      this.logger.warn(`User profile with ID ${id} not found`);
      throw new NotFoundException(`User profile with ID ${id} not found`);
    }

    return userProfile;
  }

  async findByUserId(userId: string): Promise<UserProfile> {
    const userProfile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!userProfile) {
      this.logger.warn(`User profile with userId ${userId} not found`);
      throw new NotFoundException(
        `User profile with userId ${userId} not found`,
      );
    }

    return userProfile;
  }

  async update(
    id: string,
    updateUserProfileDto: UpdateUserProfileDto,
  ): Promise<UserProfile> {
    try {
      // Check if the user profile exists
      await this.findOne(id);

      const updatedProfile = await this.prisma.userProfile.update({
        where: { id },
        data: updateUserProfileDto,
      });

      this.logger.log(`Updated user profile with ID: ${id}`);
      return updatedProfile;
    } catch (error) {
      this.logger.error(
        `Error updating user profile: ${error.message}`,
        error.stack,
      );

      if (error.code === 'P2002') {
        throw new ConflictException('Email address is already in use');
      }

      throw error;
    }
  }

  async remove(id: string): Promise<UserProfile> {
    // Check if the user profile exists
    await this.findOne(id);

    const deletedProfile = await this.prisma.userProfile.delete({
      where: { id },
    });

    this.logger.log(`Deleted user profile with ID: ${id}`);
    return deletedProfile;
  }

  async getUserBookings(
    userProfileId: string,
    params: {
      status?: 'UPCOMING' | 'PAST' | 'CANCELLED';
    } = {},
  ) {
    // Check if the user profile exists
    await this.findOne(userProfileId);

    const now = new Date();
    let whereClause: any = { userProfileId };

    if (params.status === 'UPCOMING') {
      // Find bookings where the flight is in the future
      whereClause = {
        ...whereClause,
        flight: {
          departureTime: {
            gt: now,
          },
        },
        status: {
          not: 'Cancelled',
        },
      };
    } else if (params.status === 'PAST') {
      // Find bookings where the flight is in the past
      whereClause = {
        ...whereClause,
        flight: {
          departureTime: {
            lt: now,
          },
        },
        status: {
          not: 'Cancelled',
        },
      };
    } else if (params.status === 'CANCELLED') {
      // Find cancelled bookings
      whereClause = {
        ...whereClause,
        status: 'Cancelled',
      };
    }

    return this.prisma.booking.findMany({
      where: whereClause,
      include: {
        flight: {
          include: {
            origin: true,
            destination: true,
          },
        },
        bookedSeats: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
