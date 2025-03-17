import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { AdminGuard } from '../guards/admin.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '@prisma/client';

describe('AdminGuard', () => {
  let guard: AdminGuard;
  let prismaService: PrismaService;

  const mockPrismaService = {
    userProfile: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminGuard,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    guard = module.get<AdminGuard>(AdminGuard);
    prismaService = module.get<PrismaService>(PrismaService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    // Fix the mock to use userId instead of id
    const mockExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            userId: 'test-user-id',
            email: 'test@example.com',
          },
        }),
      }),
    } as ExecutionContext;

    it('should allow access for admin users', async () => {
      mockPrismaService.userProfile.findUnique.mockResolvedValueOnce({
        role: UserRole.ADMIN,
      });

      const result = await guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
      expect(mockPrismaService.userProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'test-user-id' },
        select: { role: true },
      });
    });

    it('should allow access when user has admin role in JWT', async () => {
      const mockContextWithAdminRole = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              userId: 'test-admin-id',
              email: 'admin@example.com',
              role: 'admin',
            },
          }),
        }),
      } as ExecutionContext;

      const result = await guard.canActivate(mockContextWithAdminRole);
      expect(result).toBe(true);
      // Should not query the database since role is in JWT
      expect(mockPrismaService.userProfile.findUnique).not.toHaveBeenCalled();
    });

    it('should deny access for non-admin users', async () => {
      mockPrismaService.userProfile.findUnique.mockResolvedValueOnce({
        role: UserRole.USER,
      });

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should deny access for non-authenticated users', async () => {
      const mockContextWithoutUser = {
        switchToHttp: () => ({
          getRequest: () => ({}),
        }),
      } as ExecutionContext;

      await expect(guard.canActivate(mockContextWithoutUser)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should deny access when user profile not found', async () => {
      mockPrismaService.userProfile.findUnique.mockResolvedValueOnce(null);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
