import { Test, TestingModule } from '@nestjs/testing';
import { UserProfileService } from './user-profile.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { UserProfile } from '@prisma/client';
import { CreateUserProfileDto } from './dto/create-user-profile.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

describe('UserProfileService', () => {
  let service: UserProfileService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    userProfile: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    booking: {
      findMany: jest.fn(),
    },
  };

  const mockUserProfile: UserProfile = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    userId: 'auth0|123456789',
    fullName: 'John Doe',
    email: 'john@example.com',
    phone: '+1234567890',
    address: '123 Test St',
    birthdate: new Date('1990-01-01'),
    paymentInfo: null,
    preferences: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserProfileService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UserProfileService>(UserProfileService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a user profile', async () => {
      const createDto: CreateUserProfileDto = {
        userId: 'auth0|123456789',
        fullName: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        address: '123 Test St',
        birthdate: new Date('1990-01-01'),
      };

      mockPrismaService.userProfile.create.mockResolvedValue(mockUserProfile);

      const result = await service.create(createDto);
      expect(result).toEqual(mockUserProfile);
      expect(mockPrismaService.userProfile.create).toHaveBeenCalledWith({
        data: createDto,
      });
    });

    it('should throw ConflictException if email or userId already exists', async () => {
      const createDto: CreateUserProfileDto = {
        userId: 'auth0|123456789',
        fullName: 'John Doe',
        email: 'john@example.com',
      };

      const prismaError = new Error('Unique constraint failed');
      prismaError['code'] = 'P2002';
      mockPrismaService.userProfile.create.mockRejectedValue(prismaError);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return an array of user profiles', async () => {
      const userProfiles = [mockUserProfile];
      mockPrismaService.userProfile.findMany.mockResolvedValue(userProfiles);

      const result = await service.findAll();
      expect(result).toEqual(userProfiles);
    });
  });

  describe('findOne', () => {
    it('should return a user profile by id', async () => {
      mockPrismaService.userProfile.findUnique.mockResolvedValue(mockUserProfile);

      const result = await service.findOne(mockUserProfile.id);
      expect(result).toEqual(mockUserProfile);
      expect(mockPrismaService.userProfile.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserProfile.id },
      });
    });

    it('should throw NotFoundException if user profile not found', async () => {
      mockPrismaService.userProfile.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByUserId', () => {
    it('should return a user profile by userId', async () => {
      mockPrismaService.userProfile.findUnique.mockResolvedValue(mockUserProfile);

      const result = await service.findByUserId(mockUserProfile.userId);
      expect(result).toEqual(mockUserProfile);
      expect(mockPrismaService.userProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: mockUserProfile.userId },
      });
    });

    it('should throw NotFoundException if user profile not found', async () => {
      mockPrismaService.userProfile.findUnique.mockResolvedValue(null);

      await expect(service.findByUserId('non-existent-userId')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a user profile', async () => {
      const updateDto: UpdateUserProfileDto = {
        fullName: 'Updated Name',
      };

      mockPrismaService.userProfile.findUnique.mockResolvedValue(mockUserProfile);
      mockPrismaService.userProfile.update.mockResolvedValue({
        ...mockUserProfile,
        fullName: 'Updated Name',
      });

      const result = await service.update(mockUserProfile.id, updateDto);
      expect(result.fullName).toEqual('Updated Name');
      expect(mockPrismaService.userProfile.update).toHaveBeenCalledWith({
        where: { id: mockUserProfile.id },
        data: updateDto,
      });
    });

    it('should throw NotFoundException if user profile not found', async () => {
      const updateDto: UpdateUserProfileDto = {
        fullName: 'Updated Name',
      };

      mockPrismaService.userProfile.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent-id', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if email is already in use', async () => {
      const updateDto: UpdateUserProfileDto = {
        email: 'already-used@example.com',
      };

      mockPrismaService.userProfile.findUnique.mockResolvedValue(mockUserProfile);
      
      const prismaError = new Error('Unique constraint failed');
      prismaError['code'] = 'P2002';
      mockPrismaService.userProfile.update.mockRejectedValue(prismaError);

      await expect(service.update(mockUserProfile.id, updateDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should delete a user profile', async () => {
      mockPrismaService.userProfile.findUnique.mockResolvedValue(mockUserProfile);
      mockPrismaService.userProfile.delete.mockResolvedValue(mockUserProfile);

      const result = await service.remove(mockUserProfile.id);
      expect(result).toEqual(mockUserProfile);
      expect(mockPrismaService.userProfile.delete).toHaveBeenCalledWith({
        where: { id: mockUserProfile.id },
      });
    });

    it('should throw NotFoundException if user profile not found', async () => {
      mockPrismaService.userProfile.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserBookings', () => {
    it('should return user bookings with the specified status', async () => {
      const mockBookings = [
        {
          id: 'booking-id',
          flightId: 'flight-id',
          userProfileId: mockUserProfile.id,
          status: 'Confirmed',
        },
      ];

      mockPrismaService.userProfile.findUnique.mockResolvedValue(mockUserProfile);
      mockPrismaService.booking.findMany.mockResolvedValue(mockBookings);

      const result = await service.getUserBookings(mockUserProfile.id, { status: 'UPCOMING' });
      expect(result).toEqual(mockBookings);
      expect(mockPrismaService.booking.findMany).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user profile not found', async () => {
      mockPrismaService.userProfile.findUnique.mockResolvedValue(null);

      await expect(service.getUserBookings('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });
}); 