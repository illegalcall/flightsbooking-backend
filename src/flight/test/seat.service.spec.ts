import { Test, TestingModule } from '@nestjs/testing';
import { SeatService } from '../seat.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CabinClass, SeatLockStatus } from '@prisma/client';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockPrismaService = {
  flight: {
    findUnique: jest.fn(),
  },
  seat: {
    findMany: jest.fn(),
  },
  booking: {
    findMany: jest.fn(),
  },
  seatLock: {
    findMany: jest.fn(),
  },
};

describe('SeatService', () => {
  let service: SeatService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeatService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<SeatService>(SeatService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Reset all mocks between tests
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSeatsForFlight', () => {
    const mockFlightId = 'mock-flight-id';
    const mockFlightData = { id: mockFlightId, flightNumber: 'FL123' };
    const mockSeats = [
      {
        id: 'seat-1',
        flightId: mockFlightId,
        seatNumber: '1A',
        cabin: CabinClass.First,
        position: { row: 1, col: 'A' },
        isBlocked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'seat-2',
        flightId: mockFlightId,
        seatNumber: '1B',
        cabin: CabinClass.First,
        position: { row: 1, col: 'B' },
        isBlocked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const mockBookings = [
      {
        id: 'booking-1',
        bookedSeats: [{ id: 'seat-1' }],
      },
    ];
    const mockLocks = [
      {
        seatId: 'seat-2',
        status: SeatLockStatus.Active,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins from now
      },
    ];

    it('should throw NotFoundException if flight does not exist', async () => {
      mockPrismaService.flight.findUnique.mockResolvedValue(null);

      await expect(service.getSeatsForFlight(mockFlightId)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.flight.findUnique).toHaveBeenCalledWith({
        where: { id: mockFlightId },
      });
    });

    it('should return empty array if no seats found', async () => {
      mockPrismaService.flight.findUnique.mockResolvedValue(mockFlightData);
      mockPrismaService.seat.findMany.mockResolvedValue([]);

      const result = await service.getSeatsForFlight(mockFlightId);
      expect(result).toEqual([]);
      expect(mockPrismaService.booking.findMany).not.toHaveBeenCalled();
      expect(mockPrismaService.seatLock.findMany).not.toHaveBeenCalled();
    });

    it('should return seats with booking and lock status', async () => {
      mockPrismaService.flight.findUnique.mockResolvedValue(mockFlightData);
      mockPrismaService.seat.findMany.mockResolvedValue(mockSeats);
      mockPrismaService.booking.findMany.mockResolvedValue(mockBookings);
      mockPrismaService.seatLock.findMany.mockResolvedValue(mockLocks);

      const result = await service.getSeatsForFlight(mockFlightId);

      expect(result).toHaveLength(2);
      expect(result[0].isBooked).toBe(true);
      expect(result[0].isLocked).toBe(false);
      expect(result[1].isBooked).toBe(false);
      expect(result[1].isLocked).toBe(true);

      expect(mockPrismaService.seat.findMany).toHaveBeenCalledWith({
        where: { flightId: mockFlightId },
      });
    });

    it('should filter seats by cabin class when specified', async () => {
      mockPrismaService.flight.findUnique.mockResolvedValue(mockFlightData);
      mockPrismaService.seat.findMany.mockResolvedValue(mockSeats);
      mockPrismaService.booking.findMany.mockResolvedValue([]);
      mockPrismaService.seatLock.findMany.mockResolvedValue([]);

      await service.getSeatsForFlight(mockFlightId, CabinClass.First);

      expect(mockPrismaService.seat.findMany).toHaveBeenCalledWith({
        where: { flightId: mockFlightId, cabin: CabinClass.First },
      });
    });
  });

  describe('getSeatMap', () => {
    const mockFlightId = 'mock-flight-id';
    const mockSeats = [
      {
        id: 'seat-1',
        flightId: mockFlightId,
        seatNumber: '1A',
        cabin: CabinClass.First,
        position: { row: 1, col: 'A' },
        isBlocked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        isBooked: false,
        isLocked: false,
      },
      {
        id: 'seat-2',
        flightId: mockFlightId,
        seatNumber: '1B',
        cabin: CabinClass.First,
        position: { row: 1, col: 'B' },
        isBlocked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        isBooked: false,
        isLocked: false,
      },
      {
        id: 'seat-3',
        flightId: mockFlightId,
        seatNumber: '10A',
        cabin: CabinClass.Economy,
        position: { row: 10, col: 'A' },
        isBlocked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        isBooked: false,
        isLocked: false,
      },
    ];

    it('should throw BadRequestException if no seats are found', async () => {
      jest.spyOn(service, 'getSeatsForFlight').mockResolvedValue([]);

      await expect(service.getSeatMap(mockFlightId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return seat maps organized by cabin class', async () => {
      jest.spyOn(service, 'getSeatsForFlight').mockResolvedValue(mockSeats);

      const result = await service.getSeatMap(mockFlightId);

      expect(result.flightId).toBe(mockFlightId);
      expect(result.seatMaps).toHaveLength(2); // First and Economy classes

      const firstClassMap = result.seatMaps.find(
        (map) => map.cabin === CabinClass.First,
      );
      expect(firstClassMap).toBeDefined();
      expect(firstClassMap.rows).toBe(1);
      expect(firstClassMap.columns).toEqual(['A', 'B']);
      expect(firstClassMap.seats).toHaveLength(2);

      const economyClassMap = result.seatMaps.find(
        (map) => map.cabin === CabinClass.Economy,
      );
      expect(economyClassMap).toBeDefined();
      expect(economyClassMap.rows).toBe(1);
      expect(economyClassMap.columns).toEqual(['A']);
      expect(economyClassMap.seats).toHaveLength(1);
    });
  });
});
