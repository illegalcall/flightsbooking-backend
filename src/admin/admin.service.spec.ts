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
      updateMany: jest.fn(),
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

    // Reset all mocks before each test
    jest.clearAllMocks();
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
      expect(mockPrismaService.userProfile.findMany).toHaveBeenCalled();
      expect(mockPrismaService.userProfile.count).toHaveBeenCalled();
    });

    it('should apply filters when provided', async () => {
      const filters = {
        page: 2,
        limit: 5,
        role: UserRole.ADMIN,
        search: 'test',
        sortBy: 'email',
        sortOrder: 'asc' as 'asc' | 'desc',
      };

      await service.listUsers(filters);

      expect(mockPrismaService.userProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
          orderBy: { email: 'asc' },
          where: expect.objectContaining({
            role: UserRole.ADMIN,
          }),
        }),
      );
    });
  });

  describe('getUserDetails', () => {
    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.userProfile.findUnique.mockResolvedValueOnce(null);

      await expect(service.getUserDetails('999')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return user details with recent bookings', async () => {
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

      mockPrismaService.userProfile.findUnique.mockResolvedValueOnce(mockUser);

      const result = await service.getUserDetails('1');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('1');
      expect(result.data).toHaveProperty('recentBookings');
      expect(mockPrismaService.userProfile.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: expect.any(Object),
      });
    });
  });

  describe('updateUserRole', () => {
    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.userProfile.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.updateUserRole('999', { role: UserRole.ADMIN }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update user role successfully', async () => {
      const mockUser = {
        id: '1',
        userId: 'auth0|1',
        fullName: 'John Doe',
        email: 'john@example.com',
        role: UserRole.USER,
      };

      const updatedUser = {
        ...mockUser,
        role: UserRole.ADMIN,
      };

      mockPrismaService.userProfile.findUnique.mockResolvedValueOnce(mockUser);
      mockPrismaService.userProfile.update.mockResolvedValueOnce(updatedUser);

      const result = await service.updateUserRole('1', {
        role: UserRole.ADMIN,
      });

      expect(result.success).toBe(true);
      expect(result.data.role).toBe(UserRole.ADMIN);
      expect(mockPrismaService.userProfile.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { role: UserRole.ADMIN },
      });
    });
  });

  describe('disableUser', () => {
    it('should return success message', async () => {
      const result = await service.disableUser('1');

      expect(result.success).toBe(true);
      expect(result.message).toContain('disabled successfully');
    });
  });

  describe('listBookings', () => {
    it('should return paginated bookings list', async () => {
      const mockBookings = [
        {
          id: '1',
          bookingReference: 'BR12345',
          status: BookingStatus.Confirmed,
          userProfile: {
            id: '1',
            fullName: 'John Doe',
            email: 'john@example.com',
          },
          flight: { origin: { code: 'JFK' }, destination: { code: 'LAX' } },
        },
      ];

      mockPrismaService.booking.count.mockResolvedValueOnce(1);
      mockPrismaService.booking.findMany.mockResolvedValueOnce(mockBookings);

      const result = await service.listBookings({
        page: 1,
        limit: 10,
      });

      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.total).toBe(1);
      expect(mockPrismaService.booking.findMany).toHaveBeenCalled();
      expect(mockPrismaService.booking.count).toHaveBeenCalled();
    });

    it('should apply filters when provided', async () => {
      const filters = {
        page: 2,
        limit: 5,
        status: BookingStatus.Confirmed,
        cabinClass: 'ECONOMY' as any,
        search: 'BR12345',
        fromDate: '2023-01-01',
        toDate: '2023-12-31',
        sortBy: 'createdAt',
        sortOrder: 'desc' as 'asc' | 'desc',
      };

      await service.listBookings(filters);

      expect(mockPrismaService.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
          orderBy: { createdAt: 'desc' },
          where: expect.objectContaining({
            status: BookingStatus.Confirmed,
            selectedCabin: 'ECONOMY',
          }),
        }),
      );
    });
  });

  describe('getBookingDetails', () => {
    it('should throw NotFoundException when booking not found', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValueOnce(null);

      await expect(service.getBookingDetails('999')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return booking details', async () => {
      const mockBooking = {
        id: '1',
        bookingReference: 'BR12345',
        status: BookingStatus.Confirmed,
        userProfile: {
          id: '1',
          fullName: 'John Doe',
          email: 'john@example.com',
        },
        flight: { origin: { code: 'JFK' }, destination: { code: 'LAX' } },
      };

      mockPrismaService.booking.findUnique.mockResolvedValueOnce(mockBooking);

      const result = await service.getBookingDetails('1');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('1');
      expect(mockPrismaService.booking.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: expect.any(Object),
      });
    });
  });

  describe('updateBookingStatus', () => {
    it('should throw NotFoundException when booking not found', async () => {
      mockPrismaService.booking.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.updateBookingStatus('999', { status: BookingStatus.Confirmed }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update booking status to confirmed', async () => {
      const mockBooking = {
        id: '1',
        bookingReference: 'BR12345',
        status: BookingStatus.AwaitingPayment,
      };

      const updatedBooking = {
        ...mockBooking,
        status: BookingStatus.Confirmed,
        confirmedAt: expect.any(Date),
      };

      mockPrismaService.booking.findUnique.mockResolvedValueOnce(mockBooking);
      mockPrismaService.booking.update.mockResolvedValueOnce(updatedBooking);

      const result = await service.updateBookingStatus('1', {
        status: BookingStatus.Confirmed,
      });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe(BookingStatus.Confirmed);
      expect(mockPrismaService.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1' },
          data: expect.objectContaining({
            status: BookingStatus.Confirmed,
            confirmedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should update booking status to cancelled with reason', async () => {
      const mockBooking = {
        id: '1',
        bookingReference: 'BR12345',
        status: BookingStatus.Confirmed,
      };

      mockPrismaService.booking.findUnique.mockResolvedValueOnce(mockBooking);
      mockPrismaService.booking.update.mockResolvedValueOnce({
        ...mockBooking,
        status: BookingStatus.Cancelled,
        cancellationReason: 'No show',
        cancelledAt: expect.any(Date),
      });

      const result = await service.updateBookingStatus('1', {
        status: BookingStatus.Cancelled,
        reason: 'No show',
      });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe(BookingStatus.Cancelled);
      expect(mockPrismaService.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: BookingStatus.Cancelled,
            cancellationReason: 'No show',
            cancelledAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('listFlights', () => {
    it('should return paginated flights list', async () => {
      const mockFlights = [
        {
          id: '1',
          flightNumber: 'FL123',
          airline: 'Test Airlines',
          status: FlightStatus.Scheduled,
          origin: { code: 'JFK', city: 'New York' },
          destination: { code: 'LAX', city: 'Los Angeles' },
        },
      ];

      mockPrismaService.flight.count.mockResolvedValueOnce(1);
      mockPrismaService.flight.findMany.mockResolvedValueOnce(mockFlights);

      const result = await service.listFlights({
        page: 1,
        limit: 10,
      });

      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.total).toBe(1);
      expect(mockPrismaService.flight.findMany).toHaveBeenCalled();
      expect(mockPrismaService.flight.count).toHaveBeenCalled();
    });

    it('should apply filters when provided', async () => {
      const filters = {
        page: 2,
        limit: 5,
        airline: 'Test Airlines',
        flightNumber: 'FL123',
        originCode: 'JFK',
        destinationCode: 'LAX',
        status: FlightStatus.Scheduled,
        fromDate: '2023-01-01',
        toDate: '2023-12-31',
        sortBy: 'departureTime',
        sortOrder: 'asc' as 'asc' | 'desc',
      };

      await service.listFlights(filters);

      expect(mockPrismaService.flight.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
          orderBy: { departureTime: 'asc' },
          where: expect.objectContaining({
            airline: expect.any(Object),
            flightNumber: expect.any(Object),
          }),
        }),
      );
    });
  });

  describe('createFlight', () => {
    it('should throw NotFoundException when origin airport not found', async () => {
      mockPrismaService.airport.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.airport.findUnique.mockResolvedValueOnce({
        id: 'dest1',
        code: 'LAX',
      });

      await expect(
        service.createFlight({
          flightNumber: 'FL123',
          airline: 'Test Airlines',
          aircraftType: 'Boeing 737',
          departureTime: '2023-01-01T12:00:00Z',
          arrivalTime: '2023-01-01T15:00:00Z',
          duration: 180,
          originId: 'origin1',
          destinationId: 'dest1',
          basePrice: 199.99,
          totalSeats: JSON.stringify({ ECONOMY: 150, BUSINESS: 20, FIRST: 10 }),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when destination airport not found', async () => {
      mockPrismaService.airport.findUnique.mockResolvedValueOnce({
        id: 'origin1',
        code: 'JFK',
      });
      mockPrismaService.airport.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.createFlight({
          flightNumber: 'FL123',
          airline: 'Test Airlines',
          aircraftType: 'Boeing 737',
          departureTime: '2023-01-01T12:00:00Z',
          arrivalTime: '2023-01-01T15:00:00Z',
          duration: 180,
          originId: 'origin1',
          destinationId: 'dest1',
          basePrice: 199.99,
          totalSeats: JSON.stringify({ ECONOMY: 150, BUSINESS: 20, FIRST: 10 }),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create a flight successfully', async () => {
      const mockFlight = {
        id: '1',
        flightNumber: 'FL123',
        airline: 'Test Airlines',
        aircraftType: 'Boeing 737',
        departureTime: new Date('2023-01-01T12:00:00Z'),
        arrivalTime: new Date('2023-01-01T15:00:00Z'),
        duration: 180,
        originId: 'origin1',
        destinationId: 'dest1',
        basePrice: 199.99,
        totalSeats: { ECONOMY: 150, BUSINESS: 20, FIRST: 10 },
        status: FlightStatus.Scheduled,
        origin: { code: 'JFK', city: 'New York' },
        destination: { code: 'LAX', city: 'Los Angeles' },
      };

      mockPrismaService.airport.findUnique.mockResolvedValueOnce({
        id: 'origin1',
        code: 'JFK',
      });
      mockPrismaService.airport.findUnique.mockResolvedValueOnce({
        id: 'dest1',
        code: 'LAX',
      });
      mockPrismaService.flight.create.mockResolvedValueOnce(mockFlight);

      const result = await service.createFlight({
        flightNumber: 'FL123',
        airline: 'Test Airlines',
        aircraftType: 'Boeing 737',
        departureTime: '2023-01-01T12:00:00Z',
        arrivalTime: '2023-01-01T15:00:00Z',
        duration: 180,
        originId: 'origin1',
        destinationId: 'dest1',
        basePrice: 199.99,
        totalSeats: JSON.stringify({ ECONOMY: 150, BUSINESS: 20, FIRST: 10 }),
      });

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('1');
      expect(mockPrismaService.flight.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            flightNumber: 'FL123',
            airline: 'Test Airlines',
            totalSeats: { ECONOMY: 150, BUSINESS: 20, FIRST: 10 },
          }),
        }),
      );
    });
  });

  describe('updateFlight', () => {
    it('should throw NotFoundException when flight not found', async () => {
      mockPrismaService.flight.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.updateFlight('999', {
          flightNumber: 'FL123',
          airline: 'Test Airlines',
          aircraftType: 'Boeing 737',
          departureTime: '2023-01-01T12:00:00Z',
          arrivalTime: '2023-01-01T15:00:00Z',
          duration: 180,
          originId: 'origin1',
          destinationId: 'dest1',
          basePrice: 199.99,
          totalSeats: JSON.stringify({ ECONOMY: 150 }),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update flight successfully', async () => {
      const mockFlight = {
        id: '1',
        flightNumber: 'FL123',
        airline: 'Test Airlines',
        status: FlightStatus.Scheduled,
        bookings: [],
      };

      const updatedFlight = {
        ...mockFlight,
        departureTime: new Date('2023-01-01T13:00:00Z'),
        arrivalTime: new Date('2023-01-01T16:00:00Z'),
        origin: { code: 'JFK' },
        destination: { code: 'LAX' },
      };

      mockPrismaService.flight.findUnique.mockResolvedValueOnce(mockFlight);
      mockPrismaService.flight.update.mockResolvedValueOnce(updatedFlight);

      const result = await service.updateFlight('1', {
        flightNumber: 'FL123',
        airline: 'Test Airlines',
        aircraftType: 'Boeing 737',
        departureTime: '2023-01-01T13:00:00Z',
        arrivalTime: '2023-01-01T16:00:00Z',
        duration: 180,
        originId: 'origin1',
        destinationId: 'dest1',
        basePrice: 199.99,
        totalSeats: JSON.stringify({ ECONOMY: 150 }),
      });

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('1');
      expect(mockPrismaService.flight.update).toHaveBeenCalled();
    });

    it('should cancel affected bookings when flight is cancelled', async () => {
      const mockFlight = {
        id: '1',
        flightNumber: 'FL123',
        airline: 'Test Airlines',
        status: FlightStatus.Scheduled,
        bookings: [
          { id: 'booking1', status: BookingStatus.Confirmed },
          { id: 'booking2', status: BookingStatus.AwaitingPayment },
        ],
      };

      const updatedFlight = {
        ...mockFlight,
        status: FlightStatus.Cancelled,
        origin: { code: 'JFK' },
        destination: { code: 'LAX' },
      };

      mockPrismaService.flight.findUnique.mockResolvedValueOnce(mockFlight);
      mockPrismaService.flight.update.mockResolvedValueOnce(updatedFlight);

      await service.updateFlight('1', {
        flightNumber: 'FL123',
        airline: 'Test Airlines',
        aircraftType: 'Boeing 737',
        departureTime: '2023-01-01T12:00:00Z',
        arrivalTime: '2023-01-01T15:00:00Z',
        duration: 180,
        originId: 'origin1',
        destinationId: 'dest1',
        basePrice: 199.99,
        totalSeats: JSON.stringify({ ECONOMY: 150 }),
        status: FlightStatus.Cancelled,
      });

      expect(mockPrismaService.booking.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            flightId: '1',
            status: {
              in: [BookingStatus.Confirmed, BookingStatus.AwaitingPayment],
            },
          },
          data: expect.objectContaining({
            status: BookingStatus.Cancelled,
            cancellationReason: expect.any(String),
          }),
        }),
      );
    });
  });

  describe('getFlightDetails', () => {
    it('should throw NotFoundException when flight not found', async () => {
      mockPrismaService.flight.findUnique.mockResolvedValueOnce(null);

      await expect(service.getFlightDetails('999')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return flight details with bookings', async () => {
      const mockFlight = {
        id: '1',
        flightNumber: 'FL123',
        airline: 'Test Airlines',
        status: FlightStatus.Scheduled,
        origin: { code: 'JFK', city: 'New York' },
        destination: { code: 'LAX', city: 'Los Angeles' },
        bookings: [],
      };

      mockPrismaService.flight.findUnique.mockResolvedValueOnce(mockFlight);

      const result = await service.getFlightDetails('1');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('1');
      expect(mockPrismaService.flight.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: expect.any(Object),
      });
    });
  });
});
