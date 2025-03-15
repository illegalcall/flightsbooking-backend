import { Test, TestingModule } from '@nestjs/testing';
import { BookingService } from '../booking.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingStatus, CabinClass, Seat } from '@prisma/client';

describe('BookingService', () => {
  let service: BookingService;
  let prismaService: PrismaService;

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
    },
    flight: {
      findUnique: jest.fn(),
    },
    seat: {
      findMany: jest.fn(),
    },
    booking: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    seatLock: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<BookingService>(BookingService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Reset mock implementations
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createBooking', () => {
    beforeEach(() => {
      // Setup default mock implementations
      mockPrismaService.userProfile.findUnique.mockResolvedValue(
        mockUserProfile,
      );
      mockPrismaService.seat.findMany.mockImplementation((params) => {
        // Mock all kinds of seat queries
        if (params.where.bookings) {
          return []; // No booked seats
        } else if (params.where.seatLocks) {
          return []; // No locked seats
        } else {
          return [mockSeat]; // Available seats
        }
      });
      mockPrismaService.flight.findUnique.mockResolvedValue(mockFlight);
      mockPrismaService.booking.create.mockResolvedValue(mockBooking);
      mockPrismaService.seatLock.create.mockResolvedValue({});
    });

    it('should create a booking successfully', async () => {
      const result = await service.createBooking(
        mockUserId,
        mockCreateBookingDto,
      );

      expect(mockPrismaService.userProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });

      expect(mockPrismaService.seat.findMany).toHaveBeenCalledTimes(3);
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.bookingReference).toBe(mockBooking.bookingReference);
    });

    it('should throw NotFoundException if user profile is not found', async () => {
      mockPrismaService.userProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.createBooking(mockUserId, mockCreateBookingDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if seats are already booked', async () => {
      mockPrismaService.seat.findMany.mockImplementation((params) => {
        if (params.where.bookings && params.where.bookings.some) {
          return [mockSeat]; // Seat is already booked
        } else {
          return [mockSeat]; // Seat exists
        }
      });

      await expect(
        service.createBooking(mockUserId, mockCreateBookingDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findUserBookings', () => {
    it('should return all bookings for a user', async () => {
      mockPrismaService.userProfile.findUnique.mockResolvedValue(
        mockUserProfile,
      );
      mockPrismaService.booking.findMany.mockResolvedValue([mockBooking]);

      const result = await service.findUserBookings(mockUserId);

      expect(mockPrismaService.userProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });
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
      mockPrismaService.userProfile.findUnique.mockResolvedValue(
        mockUserProfile,
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
      const result = await service.cancelBooking(
        mockBookingId,
        mockUserId,
        'Test cancellation',
      );

      expect(mockPrismaService.userProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        select: { id: true },
      });
      expect(mockPrismaService.booking.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockBookingId,
          userProfileId: mockUserProfileId,
        },
        include: {
          bookedSeats: true,
        },
      });
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
