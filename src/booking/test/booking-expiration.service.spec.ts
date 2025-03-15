import { Test, TestingModule } from '@nestjs/testing';
import { BookingExpirationService } from '../booking-expiration.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { BookingStatus } from '@prisma/client';

describe('BookingExpirationService', () => {
  let service: BookingExpirationService;
  let prismaService: PrismaService;

  // Mock constants
  const mockExpiredBooking = {
    id: 'expired-booking-id',
    bookingReference: 'EXP123',
    flightId: 'flight-id',
    status: BookingStatus.Pending,
    createdAt: new Date(Date.now() - 40 * 60 * 1000), // 40 minutes ago
    bookedSeats: [{ id: 'seat-1' }, { id: 'seat-2' }],
  };

  // Setup mocks
  const mockPrismaService = {
    booking: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    seatLock: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key, defaultValue) => {
      if (key === 'PENDING_BOOKING_EXPIRY_MINUTES') return 30;
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingExpirationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<BookingExpirationService>(BookingExpirationService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleExpiredBookings', () => {
    it('should not process any bookings when none are expired', async () => {
      // Setup mock to return no expired bookings
      mockPrismaService.booking.findMany.mockResolvedValue([]);

      await service.handleExpiredBookings();

      expect(mockPrismaService.booking.findMany).toHaveBeenCalled();
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('should process and cancel expired bookings', async () => {
      // Setup mock to return expired bookings
      mockPrismaService.booking.findMany.mockResolvedValue([
        mockExpiredBooking,
      ]);
      mockPrismaService.booking.update.mockResolvedValue({
        ...mockExpiredBooking,
        status: BookingStatus.Cancelled,
      });
      mockPrismaService.seatLock.updateMany.mockResolvedValue({ count: 2 });

      await service.handleExpiredBookings();

      // Verify all necessary operations were called
      expect(mockPrismaService.booking.findMany).toHaveBeenCalled();
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockPrismaService.booking.update).toHaveBeenCalledWith({
        where: { id: mockExpiredBooking.id },
        data: expect.objectContaining({
          status: BookingStatus.Cancelled,
          cancelledAt: expect.any(Date),
          cancellationReason: expect.any(String),
        }),
      });
      expect(mockPrismaService.seatLock.updateMany).toHaveBeenCalledWith({
        where: {
          flightId: mockExpiredBooking.flightId,
          seatId: { in: ['seat-1', 'seat-2'] },
          status: 'Active',
        },
        data: {
          status: 'Released',
        },
      });
    });
  });

  describe('manuallyCleanupExpiredBookings', () => {
    it('should call handleExpiredBookings and return success message', async () => {
      // Spy on the handleExpiredBookings method
      jest.spyOn(service, 'handleExpiredBookings').mockResolvedValue(undefined);

      const result = await service.manuallyCleanupExpiredBookings();

      expect(service.handleExpiredBookings).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Expired bookings cleanup completed' });
    });
  });
});
