import { Test, TestingModule } from '@nestjs/testing';
import { FlightService } from './flight.service';
import { PrismaService } from '../prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException } from '@nestjs/common';
import { CabinClass, Flight, FlightStatus } from '@prisma/client';
import { SearchFlightDto } from './dto/search-flight.dto';

describe('FlightService', () => {
  let service: FlightService;
  let prismaService: PrismaService;
  let cacheManager: { get: jest.Mock; set: jest.Mock };

  const mockFlight = {
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
      Economy: 150,
      PremiumEconomy: 50,
      Business: 30,
      First: 10,
    },
    status: FlightStatus.Scheduled,
    createdAt: new Date(),
    updatedAt: new Date(),
    origin: {
      id: 'origin-1',
      code: 'JFK',
      name: 'John F. Kennedy International Airport',
      city: 'New York',
      country: 'USA',
      timezone: 'America/New_York',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    destination: {
      id: 'dest-1',
      code: 'LAX',
      name: 'Los Angeles International Airport',
      city: 'Los Angeles',
      country: 'USA',
      timezone: 'America/Los_Angeles',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const mockFlightWithCalculatedPrice = {
    ...mockFlight,
    calculatedPrice: 100,
  };

  beforeEach(async () => {
    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlightService,
        {
          provide: PrismaService,
          useValue: {
            flight: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
            },
            booking: {
              count: jest.fn(),
            },
            seatLock: {
              count: jest.fn(),
            },
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: cacheManager,
        },
      ],
    }).compile();

    service = module.get<FlightService>(FlightService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return a flight when it exists', async () => {
      jest
        .spyOn(prismaService.flight, 'findUnique')
        .mockResolvedValue(mockFlight);

      const result = await service.findOne('1');
      expect(result).toEqual(mockFlight);
      expect(prismaService.flight.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: {
          origin: true,
          destination: true,
        },
      });
    });

    it('should throw NotFoundException when flight does not exist', async () => {
      jest.spyOn(prismaService.flight, 'findUnique').mockResolvedValue(null);

      await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('search', () => {
    const searchDto = {
      originCode: 'JFK',
      destinationCode: 'LAX',
      departureDate: '2024-03-20',
    };

    it('should return flights matching search criteria', async () => {
      const mockFlights = [mockFlight];
      const mockFlightsWithPrice = [mockFlightWithCalculatedPrice];

      jest
        .spyOn(prismaService.flight, 'findMany')
        .mockResolvedValue(mockFlights);
      jest.spyOn(prismaService.flight, 'count').mockResolvedValue(1);
      jest.spyOn(cacheManager, 'get').mockResolvedValue(null);
      jest.spyOn(prismaService.booking, 'count').mockResolvedValue(0);

      const result = await service.search(searchDto);

      expect(result).toEqual({
        data: mockFlightsWithPrice,
        total: 1,
        hasMore: false,
        nextCursor: undefined,
      });
      expect(prismaService.flight.findMany).toHaveBeenCalled();
      expect(cacheManager.set).toHaveBeenCalled();
    });

    it('should filter flights by availability when cabin class and passengers are provided', async () => {
      const searchDtoWithCabin = {
        ...searchDto,
        cabinClass: CabinClass.Business,
        passengers: 2,
      };

      const mockFlights = [mockFlight];
      jest
        .spyOn(prismaService.flight, 'findMany')
        .mockResolvedValue(mockFlights);
      jest.spyOn(prismaService.flight, 'count').mockResolvedValue(1);
      jest.spyOn(prismaService.booking, 'count').mockResolvedValue(0);
      jest.spyOn(prismaService.seatLock, 'count').mockResolvedValue(0);
      jest.spyOn(cacheManager, 'get').mockResolvedValue(null);

      const result = await service.search(searchDtoWithCabin);

      expect(result.data.length).toBe(1);
      expect(prismaService.booking.count).toHaveBeenCalled();
      expect(prismaService.seatLock.count).toHaveBeenCalled();
    });

    it('should return cached results if available', async () => {
      const cachedResult = {
        data: [mockFlightWithCalculatedPrice],
        total: 1,
        hasMore: false,
        nextCursor: undefined,
      };

      jest.spyOn(cacheManager, 'get').mockResolvedValue(cachedResult);

      const result = await service.search(searchDto);

      expect(result).toEqual(cachedResult);
      expect(prismaService.flight.findMany).not.toHaveBeenCalled();
    });

    it('should handle cursor-based pagination', async () => {
      const searchDtoWithCursor = {
        ...searchDto,
        cursor: mockFlight.id,
        limit: 10,
      };

      const mockFlights = [mockFlight, { ...mockFlight, id: '2' }];
      jest
        .spyOn(prismaService.flight, 'findUnique')
        .mockResolvedValue(mockFlight);
      jest
        .spyOn(prismaService.flight, 'findMany')
        .mockResolvedValue(mockFlights);
      jest.spyOn(prismaService.flight, 'count').mockResolvedValue(2);
      jest.spyOn(cacheManager, 'get').mockResolvedValue(null);
      jest.spyOn(prismaService.booking, 'count').mockResolvedValue(0);

      const result = await service.search(searchDtoWithCursor);

      expect(result.hasMore).toBe(false);
      expect(result.data.length).toBe(2);
      expect(prismaService.flight.findUnique).toHaveBeenCalledWith({
        where: { id: mockFlight.id },
        select: { departureTime: true },
      });
    });
  });
});
