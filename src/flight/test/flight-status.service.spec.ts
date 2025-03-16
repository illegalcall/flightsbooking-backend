import { Test, TestingModule } from '@nestjs/testing';
import { FlightStatusService } from '../flight-status.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from '../../booking/notification.service';
import { Flight, FlightStatus } from '@prisma/client';
import { SchedulerRegistry } from '@nestjs/schedule';

describe('FlightStatusService', () => {
  let service: FlightStatusService;
  let prismaService: PrismaService;
  let configService: ConfigService;
  let notificationService: NotificationService;

  // Mock flight data for testing
  const mockFlights: Flight[] = [
    {
      id: 'flight-1',
      flightNumber: 'FL001',
      airline: 'Test Airline',
      aircraftType: 'Boeing 737',
      departureTime: new Date(new Date().getTime() + 30 * 60 * 1000), // 30 minutes from now
      arrivalTime: new Date(new Date().getTime() + 3 * 60 * 60 * 1000), // 3 hours from now
      duration: 150,
      originId: 'origin-1',
      destinationId: 'dest-1',
      basePrice: 100,
      totalSeats: {},
      status: FlightStatus.Scheduled,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'flight-2',
      flightNumber: 'FL002',
      airline: 'Test Airline',
      aircraftType: 'Airbus A320',
      departureTime: new Date(new Date().getTime() - 60 * 60 * 1000), // 1 hour ago
      arrivalTime: new Date(new Date().getTime() + 60 * 60 * 1000), // 1 hour from now
      duration: 120,
      originId: 'origin-2',
      destinationId: 'dest-2',
      basePrice: 150,
      totalSeats: {},
      status: FlightStatus.Scheduled, // Should change to InAir
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'flight-3',
      flightNumber: 'FL003',
      airline: 'Test Airline',
      aircraftType: 'Boeing 787',
      departureTime: new Date(new Date().getTime() - 3 * 60 * 60 * 1000), // 3 hours ago
      arrivalTime: new Date(new Date().getTime() - 60 * 60 * 1000), // 1 hour ago
      duration: 120,
      originId: 'origin-3',
      destinationId: 'dest-3',
      basePrice: 200,
      totalSeats: {},
      status: FlightStatus.InAir, // Should change to Landed
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  // Mock booking data
  const mockBookings = [
    {
      id: 'booking-1',
      bookingReference: 'ABC123',
      flightId: 'flight-1',
      userProfileId: 'user-1',
      status: 'Confirmed',
      userProfile: {
        id: 'user-profile-1',
        userId: 'user-1',
        fullName: 'Test User',
        email: 'test@example.com',
      },
    },
  ];

  // Setup mocks
  const mockPrismaService = {
    flight: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    booking: {
      findMany: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key, defaultValue) => {
      if (key === 'FLIGHT_STATUS_UPDATE_RETRIES') return 3;
      return defaultValue;
    }),
  };

  const mockNotificationService = {
    sendBookingStatusNotification: jest.fn().mockResolvedValue(true),
  };

  const mockSchedulerRegistry = {
    getCronJob: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlightStatusService,
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
        {
          provide: SchedulerRegistry,
          useValue: mockSchedulerRegistry,
        },
      ],
    }).compile();

    service = module.get<FlightStatusService>(FlightStatusService);
    prismaService = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);
    notificationService = module.get<NotificationService>(NotificationService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateFlightStatuses', () => {
    beforeEach(() => {
      // Default mock implementation for findMany
      mockPrismaService.flight.findMany.mockResolvedValue(mockFlights);

      // Default mock for update to simply return updated flight
      mockPrismaService.flight.update.mockImplementation((params) => {
        const flight = mockFlights.find((f) => f.id === params.where.id);
        return Promise.resolve({
          ...flight,
          status: params.data.status,
          updatedAt: params.data.updatedAt,
        });
      });

      // Default mock for bookings
      mockPrismaService.booking.findMany.mockResolvedValue(mockBookings);
    });

    it('should fetch flights for status update', async () => {
      await service.updateFlightStatuses();
      expect(mockPrismaService.flight.findMany).toHaveBeenCalled();
    });

    it('should update status of flights that need changes', async () => {
      // Mock the determineFlightStatus method to return specific values for testing
      jest
        .spyOn(service as any, 'determineFlightStatus')
        .mockImplementation((flight: Flight) => {
          if (flight.id === 'flight-1') return FlightStatus.Boarding; // Change from Scheduled to Boarding
          if (flight.id === 'flight-2') return FlightStatus.InAir; // Change from Scheduled to InAir
          if (flight.id === 'flight-3') return FlightStatus.Landed; // Change from InAir to Landed
          return flight.status; // Default - no change
        });

      await service.updateFlightStatuses();

      // Should have updated three flights
      expect(mockPrismaService.flight.update).toHaveBeenCalledTimes(3);

      // Check specific updates
      expect(mockPrismaService.flight.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'flight-1' },
          data: { status: FlightStatus.Boarding, updatedAt: expect.any(Date) },
        }),
      );

      expect(mockPrismaService.flight.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'flight-2' },
          data: { status: FlightStatus.InAir, updatedAt: expect.any(Date) },
        }),
      );

      expect(mockPrismaService.flight.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'flight-3' },
          data: { status: FlightStatus.Landed, updatedAt: expect.any(Date) },
        }),
      );
    });

    it('should not update flights with unchanged status', async () => {
      // Mock the determineFlightStatus to return the same status
      jest
        .spyOn(service as any, 'determineFlightStatus')
        .mockImplementation((flight: Flight) => flight.status);

      await service.updateFlightStatuses();

      // Should not have called update at all
      expect(mockPrismaService.flight.update).not.toHaveBeenCalled();
    });

    it('should notify affected bookings when flight status changes', async () => {
      // Mock flight status determination
      jest
        .spyOn(service as any, 'determineFlightStatus')
        .mockReturnValue(FlightStatus.Boarding);

      await service.updateFlightStatuses();

      // Should have fetched bookings for the flights
      expect(mockPrismaService.booking.findMany).toHaveBeenCalled();

      // Should have sent notifications
      expect(
        mockNotificationService.sendBookingStatusNotification,
      ).toHaveBeenCalled();
    });

    it('should handle errors during flight processing', async () => {
      // Mock an error when updating one specific flight
      mockPrismaService.flight.update.mockImplementation((params) => {
        if (params.where.id === 'flight-2') {
          throw new Error('Test error');
        }
        return Promise.resolve({
          ...mockFlights.find((f) => f.id === params.where.id),
          status: params.data.status,
          updatedAt: params.data.updatedAt,
        });
      });

      // Force status changes for all flights
      jest
        .spyOn(service as any, 'determineFlightStatus')
        .mockReturnValue(FlightStatus.Delayed);

      // Should not throw despite the error
      await expect(service.updateFlightStatuses()).resolves.not.toThrow();

      // Should have attempted to update all three flights
      expect(mockPrismaService.flight.update).toHaveBeenCalledTimes(3);
    });

    it('should handle complete failure gracefully', async () => {
      // Mock complete failure
      mockPrismaService.flight.findMany.mockRejectedValue(
        new Error('Database connection failed'),
      );

      // Should not throw
      await expect(service.updateFlightStatuses()).resolves.not.toThrow();
    });
  });

  describe('determineFlightStatus', () => {
    it('should set status to Landed for flights that have arrived', () => {
      const flight = {
        ...mockFlights[0],
        departureTime: new Date(new Date().getTime() - 3 * 60 * 60 * 1000), // 3 hours ago
        arrivalTime: new Date(new Date().getTime() - 60 * 60 * 1000), // 1 hour ago
      };

      const status = (service as any).determineFlightStatus(flight, new Date());
      expect(status).toBe(FlightStatus.Landed);
    });

    it('should set status to InAir for flights in progress', () => {
      const flight = {
        ...mockFlights[0],
        departureTime: new Date(new Date().getTime() - 60 * 60 * 1000), // 1 hour ago
        arrivalTime: new Date(new Date().getTime() + 60 * 60 * 1000), // 1 hour from now
      };

      const status = (service as any).determineFlightStatus(flight, new Date());
      expect(status).toBe(FlightStatus.InAir);
    });

    it('should set status to Boarding for flights about to depart', () => {
      const now = new Date();
      const flight = {
        ...mockFlights[0],
        departureTime: new Date(now.getTime() + 30 * 60 * 1000), // 30 min from now
        arrivalTime: new Date(now.getTime() + 3 * 60 * 60 * 1000), // 3 hours from now
      };

      const status = (service as any).determineFlightStatus(flight, now);
      expect(status).toBe(FlightStatus.Boarding);
    });

    it('should set status to Scheduled for future flights', () => {
      const now = new Date();
      const flight = {
        ...mockFlights[0],
        departureTime: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 1 day from now
        arrivalTime: new Date(now.getTime() + 27 * 60 * 60 * 1000), // 1 day + 3 hours from now
      };

      // Mock random to avoid the 10% chance of Delayed status
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const status = (service as any).determineFlightStatus(flight, now);
      expect(status).toBe(FlightStatus.Scheduled);
    });
  });

  describe('manuallyUpdateFlightStatuses', () => {
    it('should call updateFlightStatuses and return a message', async () => {
      // Spy on the updateFlightStatuses method
      const updateSpy = jest
        .spyOn(service, 'updateFlightStatuses')
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        .mockImplementation(async () => {});

      const result = await service.manuallyUpdateFlightStatuses();

      expect(updateSpy).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Flight status update job executed' });
    });
  });
});
