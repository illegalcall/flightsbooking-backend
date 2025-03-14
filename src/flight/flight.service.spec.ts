import { Test, TestingModule } from '@nestjs/testing';
import { FlightService } from './flight.service';
import { PrismaService } from '../prisma/prisma.service';
import { CabinClass, Flight } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { SearchFlightDto } from './dto/search-flight.dto';

// Mock data
const mockFlight: Flight = {
  id: 'mock-flight-id',
  flightNumber: 'FL123',
  airline: 'Test Airlines',
  aircraftType: 'Boeing 737',
  departureTime: new Date('2023-12-25T08:00:00Z'),
  arrivalTime: new Date('2023-12-25T10:00:00Z'),
  duration: 120,
  originId: 'origin-id',
  destinationId: 'destination-id',
  basePrice: 100,
  totalSeats: { Economy: 100, Business: 20, First: 10 },
  status: 'Scheduled',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock Prisma service
const mockPrismaService = {
  flight: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  booking: {
    count: jest.fn(),
  },
  seatLock: {
    count: jest.fn(),
  },
};

describe('FlightService', () => {
  let service: FlightService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlightService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<FlightService>(FlightService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return a flight when it exists', async () => {
      // Arrange
      mockPrismaService.flight.findUnique.mockResolvedValue({
        ...mockFlight,
        origin: { id: 'origin-id', code: 'JFK' },
        destination: { id: 'destination-id', code: 'LAX' },
      });

      // Act
      const result = await service.findOne('mock-flight-id');

      // Assert
      expect(result).toEqual({
        ...mockFlight,
        origin: { id: 'origin-id', code: 'JFK' },
        destination: { id: 'destination-id', code: 'LAX' },
      });
      expect(mockPrismaService.flight.findUnique).toHaveBeenCalledWith({
        where: { id: 'mock-flight-id' },
        include: {
          origin: true,
          destination: true,
        },
      });
    });

    it('should throw NotFoundException when flight does not exist', async () => {
      // Arrange
      mockPrismaService.flight.findUnique.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaService.flight.findUnique).toHaveBeenCalledWith({
        where: { id: 'non-existent-id' },
        include: {
          origin: true,
          destination: true,
        },
      });
    });
  });

  describe('search', () => {
    it('should return flights matching search criteria', async () => {
      // Arrange
      const searchDto: SearchFlightDto = {
        originCode: 'JFK',
        destinationCode: 'LAX',
        departureDate: '2023-12-25',
      };

      const expectedFlights = [
        {
          ...mockFlight,
          origin: { id: 'origin-id', code: 'JFK' },
          destination: { id: 'destination-id', code: 'LAX' },
        },
      ];

      mockPrismaService.flight.findMany.mockResolvedValue(expectedFlights);

      // Act
      const result = await service.search(searchDto);

      // Assert
      expect(result).toEqual(expectedFlights);
      expect(mockPrismaService.flight.findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            {
              origin: { code: 'JFK' },
              destination: { code: 'LAX' },
            },
            {
              departureTime: {
                gte: expect.any(Date),
                lte: expect.any(Date),
              },
            },
          ],
        },
        include: {
          origin: true,
          destination: true,
        },
        orderBy: {
          departureTime: 'asc',
        },
      });
    });

    it('should filter flights by availability when cabin class and passengers are provided', async () => {
      // Arrange
      const searchDto: SearchFlightDto = {
        originCode: 'JFK',
        destinationCode: 'LAX',
        departureDate: '2023-12-25',
        cabinClass: CabinClass.Economy,
        passengers: 2,
      };

      const mockFlights = [
        {
          ...mockFlight,
          origin: { id: 'origin-id', code: 'JFK' },
          destination: { id: 'destination-id', code: 'LAX' },
        },
      ];

      mockPrismaService.flight.findMany.mockResolvedValue(mockFlights);
      mockPrismaService.booking.count.mockResolvedValue(20); // 20 seats booked
      mockPrismaService.seatLock.count.mockResolvedValue(5); // 5 seats locked

      // Act
      const result = await service.search(searchDto);

      // Assert
      expect(result).toEqual(mockFlights); // Should still be available as 100 total - 20 booked - 5 locked = 75 available
      expect(mockPrismaService.booking.count).toHaveBeenCalledWith({
        where: {
          flightId: 'mock-flight-id',
          selectedCabin: CabinClass.Economy,
          status: {
            in: ['Confirmed', 'Pending', 'AwaitingPayment'],
          },
        },
      });
      expect(mockPrismaService.seatLock.count).toHaveBeenCalledWith({
        where: {
          flightId: 'mock-flight-id',
          seat: {
            cabin: CabinClass.Economy,
          },
          status: 'Active',
          expiresAt: {
            gt: expect.any(Date),
          },
        },
      });
    });
  });
});
