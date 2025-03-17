import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { UserRole, BookingStatus, FlightStatus } from '@prisma/client';

describe('AdminService', () => {
  let service: AdminService;
  let prismaService: PrismaService;

  // Create a mock PrismaService
  const mockPrismaService = {
    userProfile: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(),
    },
    booking: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn(),
    },
    flight: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      update: jest.fn(),
    },
    airport: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest
      .fn()
      .mockImplementation((callback) => callback(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listUsers', () => {
    it('should return paginated users list', async () => {
      const mockUsers = [
        {
          id: '1',
          userId: 'auth0|1',
          fullName: 'John Doe',
          email: 'john@example.com',
          role: UserRole.USER,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { bookings: 2 },
        },
      ];

      mockPrismaService.userProfile.count.mockResolvedValueOnce(1);
      mockPrismaService.userProfile.findMany.mockResolvedValueOnce(mockUsers);

      const result = await service.listUsers({
        page: 1,
        limit: 10,
      });

      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.total).toBe(1);
    });
  });

  describe('getUserDetails', () => {
    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.userProfile.findUnique.mockResolvedValueOnce(null);

      await expect(service.getUserDetails('999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
