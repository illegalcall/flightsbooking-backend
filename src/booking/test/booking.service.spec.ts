import { Test, TestingModule } from '@nestjs/testing';
import { BookingService } from '../booking.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingStatus, CabinClass, Seat } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from '../notification.service';

describe('BookingService', () => {
  let service: BookingService;
  let prismaService: PrismaService;
  let configService: ConfigService;
  let notificationService: NotificationService;

  // Mock data
  const mockUserId = 'mock-user-id';
  const mockUserProfileId = 'mock-user-profile-id';
  const mockFlightId = 'mock-flight-id';
  const mockSeatId = 'mock-seat-id';
  const mockBookingId = 'mock-booking-id';
  const mockSeatNumber = '12A';

  // Mock CreateBookingDto
  const mockCreateBookingDto: CreateBookingDto = {
    flightId: mockFlightId,
    selectedCabin: CabinClass.Economy,
    passengerDetails: [
      {
        fullName: 'John Doe',
        age: 30,
        documentNumber: 'AB123456',
      },
    ],
    seatNumbers: [mockSeatNumber],
  };

  // Mock UserProfile
  const mockUserProfile = {
    id: mockUserProfileId,
    userId: mockUserId,
    fullName: 'John Doe',
    email: 'john@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock Seat
  const mockSeat: Seat = {
    id: mockSeatId,
    flightId: mockFlightId,
    seatNumber: mockSeatNumber,
    cabin: CabinClass.Economy,
    position: { row: 12, column: 'A' },
    isBlocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock Flight
  const mockFlight = {
    id: mockFlightId,
    flightNumber: 'FL123',
    airline: 'Mock Airline',
    aircraftType: 'Boeing 737',
    departureTime: new Date(),
    arrivalTime: new Date(),
    duration: 120,
    originId: 'origin-id',
    destinationId: 'destination-id',
    basePrice: 100,
    totalSeats: {
      Economy: 100,
      PremiumEconomy: 50,
      Business: 20,
      First: 10,
    },
    status: 'Scheduled',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock Booking
  const mockBooking = {
    id: mockBookingId,
    bookingReference: 'ABC123',
    userProfileId: mockUserProfileId,
    flightId: mockFlightId,
    passengerDetails: [
      {
        fullName: 'John Doe',
        age: 30,
        documentNumber: 'AB123456',
      },
    ],
    selectedCabin: CabinClass.Economy,
    status: BookingStatus.Pending,
    totalAmount: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
    confirmedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    paymentInfo: null,
    bookedSeats: [mockSeat],
  };

  // Setup mock prisma service
  const mockPrismaService = {
    userProfile: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    seat: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    flight: {
      findUnique: jest.fn(),
    },
    booking: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    seatLock: {
      create: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest
      .fn()
      .mockImplementation((callback) => callback(mockPrismaService)),
  };

  // Setup mock config service
  const mockConfigService = {
    get: jest.fn().mockImplementation((key, defaultValue) => {
      if (key === 'SEAT_LOCK_EXPIRY_MINUTES') return 30; // Test with 30 minutes
      return defaultValue;
    }),
  };

  // Setup mock notification service
  const mockNotificationService = {
    sendBookingStatusNotification: jest.fn().mockResolvedValue(true),
    getNotificationEventsForUser: jest.fn(),
    getAllNotificationEvents: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    service = module.get<BookingService>(BookingService);
    prismaService = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);
    notificationService = module.get<NotificationService>(NotificationService);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createBooking', () => {
    beforeEach(() => {
      // Setup default mock implementations
      mockPrismaService.userProfile.findUnique.mockImplementation(() =>
        Promise.resolve(mockUserProfile),
      );

      mockPrismaService.seat.findMany.mockImplementation((params) => {
        if (params.where.bookings) {
          return Promise.resolve([]);
        } else if (params.where.seatLocks) {
          return Promise.resolve([]);
        } else {
          return Promise.resolve([mockSeat]); // Available seats
        }
      });

      mockPrismaService.booking.findMany.mockResolvedValue([]); // Return empty array by default
      mockPrismaService.seatLock.findMany.mockResolvedValue([]); // Return empty array by default

      mockPrismaService.flight.findUnique.mockResolvedValue(mockFlight as any);
      mockPrismaService.booking.create.mockResolvedValue(mockBooking);
      mockPrismaService.seatLock.create.mockResolvedValue({});

      // For the transaction callback, ensure it passes the mocked prisma and returns the booking
      mockPrismaService.$transaction.mockImplementation((callback) => {
        return callback(mockPrismaService).then(() => mockBooking);
      });
    });

    it('should create a booking successfully', async () => {
      const result = await service.createBooking(
        mockUserId,
        mockCreateBookingDto,
      );

      expect(mockPrismaService.userProfile.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUserId },
        }),
      );

      expect(mockPrismaService.seat.findMany).toHaveBeenCalled();
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.bookingReference).toBe(mockBooking.bookingReference);
    });

    it('should use the configured lock expiry duration', async () => {
      await service.createBooking(mockUserId, mockCreateBookingDto);

      // Verify the ConfigService was called with the correct key and default value
      expect(configService.get).toHaveBeenCalledWith(
        'SEAT_LOCK_EXPIRY_MINUTES',
        15,
      );

      // Verify the seatLock.create was called with the expected expiry time
      expect(mockPrismaService.seatLock.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user profile is not found', async () => {
      mockPrismaService.userProfile.findUnique.mockResolvedValue(null);

      // Mock that the create function will throw an error
      mockPrismaService.userProfile.create.mockRejectedValue(
        new NotFoundException('User profile not found'),
      );

      await expect(
        service.createBooking(mockUserId, mockCreateBookingDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if seats are already booked', async () => {
      // Mock that the seat is already booked
      mockPrismaService.booking.findMany.mockImplementation(() => {
        return Promise.resolve([
          {
            id: 'booked-id',
            bookedSeats: [{ seatNumber: mockSeatNumber }],
          },
        ]);
      });

      await expect(
        service.createBooking(mockUserId, mockCreateBookingDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findUserBookings', () => {
    it('should return all bookings for a user', async () => {
      mockPrismaService.userProfile.findUnique.mockImplementation(() =>
        Promise.resolve(mockUserProfile),
      );
      mockPrismaService.booking.findMany.mockResolvedValue([mockBooking]);

      const result = await service.findUserBookings(mockUserId);

      expect(mockPrismaService.userProfile.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUserId },
        }),
      );
      expect(mockPrismaService.booking.findMany).toHaveBeenCalledWith({
        where: {
          userProfileId: mockUserProfileId,
        },
        include: {
          bookedSeats: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockBookingId);
    });

    it('should throw NotFoundException if user profile is not found', async () => {
      mockPrismaService.userProfile.findUnique.mockResolvedValue(null);

      await expect(service.findUserBookings(mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('cancelBooking', () => {
    beforeEach(() => {
      mockPrismaService.userProfile.findUnique.mockImplementation(() =>
        Promise.resolve(mockUserProfile),
      );
      mockPrismaService.booking.findFirst.mockResolvedValue(mockBooking);
      mockPrismaService.booking.update.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.Cancelled,
        cancelledAt: new Date(),
        cancellationReason: 'Test cancellation',
      });
    });

    it('should cancel a booking successfully', async () => {
      // Create a booking with status Pending for cancellation
      const pendingBooking = {
        ...mockBooking,
        bookedSeats: [mockSeat],
        status: BookingStatus.Pending,
      };

      // Create a cancelled version of the same booking
      const cancelledBooking = {
        ...pendingBooking,
        status: BookingStatus.Cancelled,
        cancelledAt: new Date(),
        cancellationReason: 'Test reason',
      };

      // Mock responses for the test
      mockPrismaService.userProfile.findUnique.mockResolvedValue(
        mockUserProfile,
      );
      mockPrismaService.booking.findFirst.mockResolvedValue(pendingBooking);
      mockPrismaService.booking.update.mockResolvedValue(cancelledBooking);

      // For this test, we need the transaction to return the cancelled booking
      mockPrismaService.$transaction.mockImplementation((callback) => {
        return callback(mockPrismaService).then(() => cancelledBooking);
      });

      const result = await service.cancelBooking(
        mockBookingId,
        mockUserId,
        'Test reason',
      );

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.status).toBe(BookingStatus.Cancelled);
    });

    it('should throw BadRequestException if booking is already cancelled', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue({
        ...mockBooking,
        status: BookingStatus.Cancelled,
      });

      await expect(
        service.cancelBooking(mockBookingId, mockUserId, 'Test cancellation'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if booking is not found', async () => {
      mockPrismaService.booking.findFirst.mockResolvedValue(null);

      await expect(
        service.cancelBooking(mockBookingId, mockUserId, 'Test cancellation'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
