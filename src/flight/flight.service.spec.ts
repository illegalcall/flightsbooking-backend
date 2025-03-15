import { Test, TestingModule } from '@nestjs/testing';
import { FlightService } from './flight.service';
import { PrismaService } from '../prisma/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotFoundException } from '@nestjs/common';
import { CabinClass, Flight, FlightStatus } from '@prisma/client';
import { SearchFlightDto } from './dto/search-flight.dto';
import { BookingService } from '../booking/booking.service';

describe('FlightService', () => {
  let service: FlightService;
  let prismaService: PrismaService;
  let cacheManager: { get: jest.Mock; set: jest.Mock };
  let bookingService: { getCabinSeatsWithMultipliers: jest.Mock };

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
    cabinSeatsWithMultipliers: {
      Economy: { seats: 150, multiplier: 1.0 },
      PremiumEconomy: { seats: 50, multiplier: 1.5 },
      Business: { seats: 30, multiplier: 2.5 },
      First: { seats: 10, multiplier: 4.0 },
    },
  };

  beforeEach(async () => {
    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };

    bookingService = {
      getCabinSeatsWithMultipliers: jest.fn().mockResolvedValue({
        Economy: { seats: 150, multiplier: 1.0 },
        PremiumEconomy: { seats: 50, multiplier: 1.5 },
        Business: { seats: 30, multiplier: 2.5 },
        First: { seats: 10, multiplier: 4.0 },
      }),
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
        {
          provide: BookingService,
          useValue: bookingService,
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
      expect(result).toEqual({
        ...mockFlight,
        cabinSeatsWithMultipliers: expect.any(Object),
      });
      expect(prismaService.flight.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: {
          origin: true,
          destination: true,
        },
      });
      expect(bookingService.getCabinSeatsWithMultipliers).toHaveBeenCalledWith(
        '1',
      );
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
        data: expect.arrayContaining([
          expect.objectContaining({
            id: mockFlightWithCalculatedPrice.id,
            calculatedPrice: mockFlightWithCalculatedPrice.calculatedPrice,
          }),
        ]),
        totalCount: 1,
        page: 1,
        pageSize: 10,
        pageCount: 1,
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
        totalCount: 1,
        page: 1,
        pageSize: 10,
        pageCount: 1,
      };

      jest.spyOn(cacheManager, 'get').mockResolvedValue(cachedResult);

      const result = await service.search(searchDto);

      expect(result).toEqual(cachedResult);
      expect(prismaService.flight.findMany).not.toHaveBeenCalled();
    });

    it('should handle page-based pagination', async () => {
      const searchDtoWithPage = {
        ...searchDto,
        page: 1,
        limit: 10,
      };

      const mockFlights = [mockFlight, { ...mockFlight, id: '2' }];
      jest
        .spyOn(prismaService.flight, 'findMany')
        .mockResolvedValue(mockFlights);
      jest.spyOn(prismaService.flight, 'count').mockResolvedValue(2);
      jest.spyOn(cacheManager, 'get').mockResolvedValue(null);
      jest.spyOn(prismaService.booking, 'count').mockResolvedValue(0);

      const result = await service.search(searchDtoWithPage);

      expect(result.pageCount).toBe(1);
      expect(result.totalCount).toBe(2);
      expect(result.data.length).toBe(2);
      expect(prismaService.flight.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
        }),
      );
    });
  });
});
