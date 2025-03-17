import { Test, TestingModule } from '@nestjs/testing';
import { SeatController } from '../seat.controller';
import { SeatService } from '../seat.service';
import { CabinClass } from '@prisma/client';
import { Seat } from '../entities/seat.entity';
import { SeatMapResponseDto } from '../dto/seat.dto';

describe('SeatController', () => {
  let controller: SeatController;
  let seatService: SeatService;

  const mockSeatService = {
    getSeatsForFlight: jest.fn(),
    getSeatMap: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SeatController],
      providers: [
        {
          provide: SeatService,
          useValue: mockSeatService,
        },
      ],
    }).compile();

    controller = module.get<SeatController>(SeatController);
    seatService = module.get<SeatService>(SeatService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getSeatsForFlight', () => {
    const flightId = 'test-flight-id';
    const mockSeats: Seat[] = [
      {
        id: 'seat-1',
        flightId,
        seatNumber: '1A',
        cabin: CabinClass.First,
        position: { row: 1, col: 'A' },
        isBlocked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        isBooked: false,
        isLocked: false,
      },
    ];

    it('should return seats for a flight', async () => {
      mockSeatService.getSeatsForFlight.mockResolvedValue(mockSeats);

      const result = await controller.getSeatsForFlight(flightId);

      expect(result).toEqual(mockSeats);
      expect(seatService.getSeatsForFlight).toHaveBeenCalledWith(
        flightId,
        undefined,
      );
    });

    it('should filter seats by cabin class when specified', async () => {
      mockSeatService.getSeatsForFlight.mockResolvedValue(mockSeats);

      await controller.getSeatsForFlight(flightId, CabinClass.First);

      expect(seatService.getSeatsForFlight).toHaveBeenCalledWith(
        flightId,
        CabinClass.First,
      );
    });
  });

  describe('getSeatMap', () => {
    const flightId = 'test-flight-id';
    const mockSeatMap: SeatMapResponseDto = {
      flightId,
      seatMaps: [
        {
          cabin: CabinClass.First,
          rows: 1,
          columns: ['A', 'B'],
          seats: [
            {
              id: 'seat-1',
              flightId,
              seatNumber: '1A',
              cabin: CabinClass.First,
              position: { row: 1, col: 'A' },
              isBlocked: false,
              createdAt: new Date(),
              updatedAt: new Date(),
              isBooked: false,
              isLocked: false,
            },
          ],
        },
      ],
    };

    it('should return seat map for a flight', async () => {
      mockSeatService.getSeatMap.mockResolvedValue(mockSeatMap);

      const result = await controller.getSeatMap(flightId);

      expect(result).toEqual(mockSeatMap);
      expect(seatService.getSeatMap).toHaveBeenCalledWith(flightId);
    });
  });
});
