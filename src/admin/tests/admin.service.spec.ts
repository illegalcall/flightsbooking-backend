import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from '../admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  UserRole,
  BookingStatus,
  FlightStatus,
  CabinClass,
} from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { NotificationService } from '../../booking/notification.service';

describe('AdminService', () => {
  let service: AdminService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    userProfile: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    booking: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    flight: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    airport: {
      findUnique: jest.fn(),
    },
  };

  // Create a mock NotificationService
  const mockNotificationService = {
    sendBookingStatusNotification: jest.fn().mockResolvedValue(true),
    sendFlightUpdateNotification: jest.fn().mockResolvedValue(true),
    getNotificationEventsForUser: jest.fn(),
    getAllNotificationEvents: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listUsers', () => {
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

    it('should return paginated users list', async () => {
      mockPrismaService.userProfile.count.mockResolvedValueOnce(1);
      mockPrismaService.userProfile.findMany.mockResolvedValueOnce(mockUsers);

      const result = await service.listUsers({
        page: 1,
        limit: 10,
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.data[0].bookingsCount).toBe(2);
    });

    it('should apply search filter correctly', async () => {
      mockPrismaService.userProfile.count.mockResolvedValueOnce(1);
      mockPrismaService.userProfile.findMany.mockResolvedValueOnce(mockUsers);

      await service.listUsers({
        search: 'john',
      });

      expect(mockPrismaService.userProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                fullName: expect.objectContaining({
                  contains: 'john',
                }),
              }),
            ]),
          }),
        }),
      );
    });
  });

  describe('getUserDetails', () => {
    const mockUser = {
      id: '1',
      userId: 'auth0|1',
      fullName: 'John Doe',
      email: 'john@example.com',
      role: UserRole.USER,
      createdAt: new Date(),
      updatedAt: new Date(),
      bookings: [],
      _count: { bookings: 0 },
    };

    it('should return user details with bookings', async () => {
      mockPrismaService.userProfile.findUnique.mockResolvedValueOnce(mockUser);

      const result = await service.getUserDetails('1');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('1');
      expect(result.data.bookingsCount).toBe(0);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.userProfile.findUnique.mockResolvedValueOnce(null);

      await expect(service.getUserDetails('999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateUserRole', () => {
    const mockUser = {
      id: '1',
      role: UserRole.USER,
    };

    it('should update user role', async () => {
      mockPrismaService.userProfile.findUnique.mockResolvedValueOnce(mockUser);
      mockPrismaService.userProfile.update.mockResolvedValueOnce({
        ...mockUser,
        role: UserRole.ADMIN,
      });

      const result = await service.updateUserRole('1', {
        role: UserRole.ADMIN,
      });

      expect(result.success).toBe(true);
      expect(result.data.role).toBe(UserRole.ADMIN);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.userProfile.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.updateUserRole('999', { role: UserRole.ADMIN }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listBookings', () => {
    const mockBookings = [
      {
        id: '1',
        bookingReference: 'BOOK123',
        userProfile: {
          id: '1',
          fullName: 'John Doe',
          email: 'john@example.com',
        },
        flight: {
          id: '1',
          flightNumber: 'FL123',
          departureTime: new Date(),
          arrivalTime: new Date(),
          origin: {
            code: 'JFK',
            city: 'New York',
          },
          destination: {
            code: 'LAX',
            city: 'Los Angeles',
          },
        },
        passengerDetails: [{ fullName: 'John Doe' }],
        selectedCabin: CabinClass.Economy,
        status: BookingStatus.Confirmed,
        totalAmount: 500,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    it('should return paginated bookings list', async () => {
      mockPrismaService.booking.count.mockResolvedValueOnce(1);
      mockPrismaService.booking.findMany.mockResolvedValueOnce(mockBookings);

      const result = await service.listBookings({
        page: 1,
        limit: 10,
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.data[0].bookingReference).toBe('BOOK123');
    });

    it('should apply search and status filters correctly', async () => {
      mockPrismaService.booking.count.mockResolvedValueOnce(1);
      mockPrismaService.booking.findMany.mockResolvedValueOnce(mockBookings);

      await service.listBookings({
        search: 'BOOK123',
        status: BookingStatus.Confirmed,
      });

      expect(mockPrismaService.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: BookingStatus.Confirmed,
            OR: expect.arrayContaining([
              expect.objectContaining({
                bookingReference: expect.objectContaining({
                  contains: 'BOOK123',
                }),
              }),
            ]),
          }),
        }),
      );
    });
  });

  describe('getBookingDetails', () => {
    const mockBooking = {
      id: '1',
      bookingReference: 'BOOK123',
      userProfile: {
        id: '1',
        fullName: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
      },
      flight: {
        id: '1',
        flightNumber: 'FL123',
        departureTime: new Date(),
        arrivalTime: new Date(),
        origin: {
          code: 'JFK',
          city: 'New York',
        },
        destination: {
          code: 'LAX',
          city: 'Los Angeles',
        },
        seats: [],
      },
      status: BookingStatus.Confirmed,
    };

    it('should return booking details', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValueOnce(mockBooking);

      const result = await service.getBookingDetails('1');

      expect(result.success).toBe(true);
      expect(result.data.bookingReference).toBe('BOOK123');
      expect(result.data.userProfile.fullName).toBe('John Doe');
    });

    it('should throw NotFoundException when booking not found', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValueOnce(null);

      await expect(service.getBookingDetails('999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateBookingStatus', () => {
    const mockBooking = {
      id: '1',
      bookingReference: 'BOOK123',
      status: BookingStatus.Pending,
      userProfile: {
        id: 'user1',
        userId: 'auth0|user1',
        email: 'user@example.com',
        fullName: 'Test User',
      },
    };

    it('should update booking status', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValueOnce(mockBooking);
      mockPrismaService.booking.update.mockResolvedValueOnce({
        ...mockBooking,
        status: BookingStatus.Confirmed,
        confirmedAt: expect.any(Date),
      });

      const result = await service.updateBookingStatus('1', {
        status: BookingStatus.Confirmed,
      });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe(BookingStatus.Confirmed);
      expect(mockPrismaService.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: BookingStatus.Confirmed,
            confirmedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should handle cancellation with reason', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValueOnce(mockBooking);
      mockPrismaService.booking.update.mockResolvedValueOnce({
        ...mockBooking,
        status: BookingStatus.Cancelled,
        cancellationReason: 'Customer request',
        cancelledAt: expect.any(Date),
      });

      const result = await service.updateBookingStatus('1', {
        status: BookingStatus.Cancelled,
        reason: 'Customer request',
      });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe(BookingStatus.Cancelled);
      expect(mockPrismaService.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: BookingStatus.Cancelled,
            cancellationReason: 'Customer request',
            cancelledAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw NotFoundException when booking not found', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.updateBookingStatus('999', {
          status: BookingStatus.Confirmed,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listFlights', () => {
    const mockFlights = [
      {
        id: '1',
        flightNumber: 'FL123',
        airline: 'Test Airlines',
        aircraftType: 'Boeing 737',
        departureTime: new Date(),
        arrivalTime: new Date(),
        duration: 120,
        originId: 'origin-1',
        destinationId: 'dest-1',
        basePrice: 100,
        totalSeats: {
          Economy: { seats: 150, multiplier: 1.0 },
        },
        status: FlightStatus.Scheduled,
        createdAt: new Date(),
        updatedAt: new Date(),
        origin: {
          code: 'JFK',
          city: 'New York',
        },
        destination: {
          code: 'LAX',
          city: 'Los Angeles',
        },
      },
    ];

    it('should return paginated flights list', async () => {
      mockPrismaService.flight.count.mockResolvedValueOnce(1);
      mockPrismaService.flight.findMany.mockResolvedValueOnce(mockFlights);

      const result = await service.listFlights({
        page: 1,
        limit: 10,
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.data[0].flightNumber).toBe('FL123');
    });

    it('should apply filters correctly', async () => {
      mockPrismaService.flight.count.mockResolvedValueOnce(1);
      mockPrismaService.flight.findMany.mockResolvedValueOnce(mockFlights);

      await service.listFlights({
        airline: 'Test',
        flightNumber: 'FL123',
        originCode: 'JFK',
        status: FlightStatus.Scheduled,
      });

      expect(mockPrismaService.flight.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            airline: expect.objectContaining({
              contains: 'Test',
            }),
            flightNumber: expect.objectContaining({
              contains: 'FL123',
            }),
            origin: expect.objectContaining({
              code: expect.objectContaining({
                equals: 'JFK',
              }),
            }),
            status: FlightStatus.Scheduled,
          }),
        }),
      );
    });
  });

  describe('createFlight', () => {
    const mockAirport = {
      id: 'airport-1',
      code: 'JFK',
      name: 'JFK Airport',
      city: 'New York',
      country: 'USA',
      timezone: 'America/New_York',
    };

    const createFlightDto = {
      flightNumber: 'FL123',
      airline: 'Test Airlines',
      aircraftType: 'Boeing 737',
      departureTime: '2024-03-25T10:00:00Z',
      arrivalTime: '2024-03-25T12:00:00Z',
      duration: 120,
      originId: 'origin-1',
      destinationId: 'dest-1',
      basePrice: 100,
      totalSeats: JSON.stringify({
        Economy: { seats: 150, multiplier: 1.0 },
      }),
    };

    it('should create a new flight', async () => {
      mockPrismaService.airport.findUnique
        .mockResolvedValueOnce(mockAirport)
        .mockResolvedValueOnce(mockAirport);

      mockPrismaService.flight.create.mockResolvedValueOnce({
        ...createFlightDto,
        id: '1',
        status: FlightStatus.Scheduled,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createFlight(createFlightDto);

      expect(result.success).toBe(true);
      expect(result.data.flightNumber).toBe('FL123');
      expect(mockPrismaService.flight.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            flightNumber: 'FL123',
            status: FlightStatus.Scheduled,
          }),
        }),
      );
    });

    it('should throw NotFoundException when origin airport not found', async () => {
      mockPrismaService.airport.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockAirport);

      await expect(service.createFlight(createFlightDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateFlight', () => {
    const mockFlight = {
      id: '1',
      flightNumber: 'FL123',
      status: FlightStatus.Scheduled,
      bookings: [],
    };

    const updateFlightDto = {
      flightNumber: 'FL123',
      airline: 'Test Airlines',
      aircraftType: 'Boeing 737',
      departureTime: '2024-03-25T10:00:00Z',
      arrivalTime: '2024-03-25T12:00:00Z',
      duration: 120,
      originId: 'origin-1',
      destinationId: 'dest-1',
      basePrice: 100,
      totalSeats: JSON.stringify({
        Economy: { seats: 150, multiplier: 1.0 },
      }),
      status: FlightStatus.Cancelled,
    };

    it('should update flight details', async () => {
      mockPrismaService.flight.findUnique.mockResolvedValueOnce(mockFlight);
      mockPrismaService.flight.update.mockResolvedValueOnce({
        ...mockFlight,
        ...updateFlightDto,
      });

      const result = await service.updateFlight('1', updateFlightDto);

      expect(result.success).toBe(true);
      expect(result.data.status).toBe(FlightStatus.Cancelled);
    });

    it('should handle cancellation with existing bookings', async () => {
      mockPrismaService.flight.findUnique.mockResolvedValueOnce({
        ...mockFlight,
        bookings: [
          {
            id: 'booking-1', 
            status: BookingStatus.Confirmed,
            userProfile: {
              id: 'user1',
              userId: 'auth0|user1',
              email: 'user@example.com',
              fullName: 'Test User',
            },
          },
          {
            id: 'booking-2', 
            status: BookingStatus.AwaitingPayment,
            userProfile: {
              id: 'user2',
              userId: 'auth0|user2',
              email: 'user2@example.com',
              fullName: 'Test User 2',
            },
          },
        ],
      });

      mockPrismaService.flight.update.mockResolvedValueOnce({
        ...mockFlight,
        ...updateFlightDto,
      });

      await service.updateFlight('1', updateFlightDto);

      expect(mockPrismaService.booking.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            flightId: '1',
            status: {
              in: [BookingStatus.Confirmed, BookingStatus.AwaitingPayment],
            },
          }),
          data: expect.objectContaining({
            status: BookingStatus.Cancelled,
            cancellationReason: 'Flight cancelled by airline',
          }),
        }),
      );
    });

    it('should throw NotFoundException when flight not found', async () => {
      mockPrismaService.flight.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.updateFlight('999', updateFlightDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getFlightDetails', () => {
    const mockFlight = {
      id: '1',
      flightNumber: 'FL123',
      airline: 'Test Airlines',
      status: FlightStatus.Scheduled,
      origin: {
        code: 'JFK',
        city: 'New York',
      },
      destination: {
        code: 'LAX',
        city: 'Los Angeles',
      },
      bookings: [
        {
          id: 'booking-1',
          userProfile: {
            id: 'user-1',
            fullName: 'John Doe',
            email: 'john@example.com',
          },
        },
      ],
    };

    it('should return flight details with bookings', async () => {
      mockPrismaService.flight.findUnique.mockResolvedValueOnce(mockFlight);

      const result = await service.getFlightDetails('1');

      expect(result.success).toBe(true);
      expect(result.data.flightNumber).toBe('FL123');
      expect(result.data.bookings).toHaveLength(1);
      expect(result.data.bookings[0].userProfile.fullName).toBe('John Doe');
    });

    it('should throw NotFoundException when flight not found', async () => {
      mockPrismaService.flight.findUnique.mockResolvedValueOnce(null);

      await expect(service.getFlightDetails('999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
