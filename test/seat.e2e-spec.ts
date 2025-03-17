import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { CabinClass } from '@prisma/client';

describe('Seat Endpoints (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let testFlightId: string;
  let firstClassSeatId: string;
  let economySeatId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prismaService = app.get<PrismaService>(PrismaService);

    // Clean up any leftover test data
    await prismaService.seat.deleteMany({
      where: {
        seatNumber: { in: ['1A-TEST', '10A-TEST'] },
      },
    });
    await prismaService.flight.deleteMany({
      where: {
        flightNumber: 'TF123-TEST',
      },
    });
    await prismaService.airport.deleteMany({
      where: {
        code: 'TST',
      },
    });

    // Create test data
    const testAirport = await prismaService.airport.create({
      data: {
        code: 'TST',
        name: 'Test Airport',
        city: 'Test City',
        country: 'Test Country',
        timezone: 'UTC',
      },
    });

    // Create a test flight
    const testFlight = await prismaService.flight.create({
      data: {
        flightNumber: 'TF123-TEST',
        airline: 'Test Airline',
        aircraftType: 'Test Aircraft',
        departureTime: new Date('2024-12-25T12:00:00Z'),
        arrivalTime: new Date('2024-12-25T15:00:00Z'),
        duration: 180,
        originId: testAirport.id,
        destinationId: testAirport.id,
        basePrice: 100,
        totalSeats: {
          Economy: { seats: 100, multiplier: 1.0 },
          Business: { seats: 20, multiplier: 2.0 },
          First: { seats: 10, multiplier: 3.0 },
        },
      },
    });

    testFlightId = testFlight.id;

    // Create test seats
    const firstClassSeat = await prismaService.seat.create({
      data: {
        flightId: testFlightId,
        seatNumber: '1A-TEST',
        cabin: CabinClass.First,
        position: { row: 1, col: 'A' },
      },
    });

    const economySeat = await prismaService.seat.create({
      data: {
        flightId: testFlightId,
        seatNumber: '10A-TEST',
        cabin: CabinClass.Economy,
        position: { row: 10, col: 'A' },
      },
    });

    firstClassSeatId = firstClassSeat.id;
    economySeatId = economySeat.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prismaService.seat.deleteMany({
      where: {
        flightId: testFlightId,
      },
    });
    await prismaService.flight.delete({
      where: {
        id: testFlightId,
      },
    });
    await prismaService.airport.deleteMany({
      where: {
        code: 'TST',
      },
    });
    await app.close();
  });

  describe('GET /api/v1/seats/flight/:flightId', () => {
    it('should return all seats for a flight', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/seats/flight/${testFlightId}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);

      const seatNumbers = response.body.map((seat) => seat.seatNumber);
      expect(seatNumbers).toContain('1A-TEST');
      expect(seatNumbers).toContain('10A-TEST');

      response.body.forEach((seat) => {
        expect(seat).toHaveProperty('id');
        expect(seat).toHaveProperty('seatNumber');
        expect(seat).toHaveProperty('cabin');
        expect(seat).toHaveProperty('position');
        expect(seat).toHaveProperty('isBlocked');
        expect(seat).toHaveProperty('isBooked');
        expect(seat).toHaveProperty('isLocked');
      });
    });

    it('should filter seats by cabin class', async () => {
      const url = `/api/v1/seats/flight/${testFlightId}?cabinClass=${CabinClass.First}`;
      const response = await request(app.getHttpServer()).get(url).expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].seatNumber).toBe('1A-TEST');
      expect(response.body[0].cabin).toBe(CabinClass.First);
    });

    it('should return 404 for non-existent flight', () => {
      return request(app.getHttpServer())
        .get('/api/v1/seats/flight/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('GET /api/v1/seats/map/:flightId', () => {
    it('should return seat map organized by cabin class', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/seats/map/${testFlightId}`)
        .expect(200);

      expect(response.body).toHaveProperty('flightId', testFlightId);
      expect(response.body).toHaveProperty('seatMaps');
      expect(Array.isArray(response.body.seatMaps)).toBe(true);
      expect(response.body.seatMaps.length).toBe(2);

      const cabins = response.body.seatMaps.map((map) => map.cabin);
      expect(cabins).toContain(CabinClass.First);
      expect(cabins).toContain(CabinClass.Economy);

      response.body.seatMaps.forEach((map) => {
        expect(map).toHaveProperty('cabin');
        expect(map).toHaveProperty('rows');
        expect(map).toHaveProperty('columns');
        expect(map).toHaveProperty('seats');
        expect(Array.isArray(map.seats)).toBe(true);
      });

      const firstClassMap = response.body.seatMaps.find(
        (map) => map.cabin === CabinClass.First,
      );
      expect(firstClassMap.seats.length).toBe(1);

      const economyClassMap = response.body.seatMaps.find(
        (map) => map.cabin === CabinClass.Economy,
      );
      expect(economyClassMap.seats.length).toBe(1);
    });

    it('should return 404 for non-existent flight', () => {
      return request(app.getHttpServer())
        .get('/api/v1/seats/map/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });
});
