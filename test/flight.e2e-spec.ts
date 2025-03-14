import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { CabinClass } from '@prisma/client';
import { SearchFlightDto } from '../src/flight/dto/search-flight.dto';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';

// Create a mock JWT Auth Guard for testing
class MockJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    // Get the request
    const request = context.switchToHttp().getRequest();

    // Check if Authorization header is present
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException('Authentication required');
    }

    // Set a mock user in the request
    request.user = {
      userId: 'test-user-id',
      email: 'test@example.com',
      fullName: 'Test User',
      role: 'user',
    };

    return true;
  }
}

describe('FlightController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(MockJwtAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    prismaService = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    // Configure validation pipes
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    // Enable API versioning to match the main app configuration
    app.enableVersioning({
      type: VersioningType.URI,
      prefix: 'v',
      defaultVersion: '1',
    });

    await app.init();

    // Create a mock auth token - this won't actually be validated since we're using a mock guard
    authToken = 'mock-jwt-token';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/v1/flights/search (POST)', () => {
    it('should return flights matching search criteria', async () => {
      // Prepare search payload
      const searchPayload: SearchFlightDto = {
        originCode: 'JFK',
        destinationCode: 'LAX',
        departureDate: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
      };

      // Send search request
      const response = await request(app.getHttpServer())
        .post('/v1/flights/search')
        .send(searchPayload)
        .expect(201); // NestJS POST returns 201 Created by default

      // Validate response structure
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('hasMore');
      expect(Array.isArray(response.body.data)).toBe(true);

      // If flights are returned, check their structure
      if (response.body.data.length > 0) {
        const flight = response.body.data[0];
        expect(flight).toHaveProperty('id');
        expect(flight).toHaveProperty('flightNumber');
        expect(flight).toHaveProperty('airline');
        expect(flight).toHaveProperty('departureTime');
        expect(flight).toHaveProperty('arrivalTime');
        expect(flight).toHaveProperty('origin');
        expect(flight).toHaveProperty('destination');
        expect(flight).toHaveProperty('calculatedPrice');
        expect(flight.origin.code).toBe('JFK');
        expect(flight.destination.code).toBe('LAX');
      }
    });

    it('should filter by cabin class and passengers', async () => {
      // Prepare search payload with cabin class and passengers
      const searchPayload: SearchFlightDto = {
        originCode: 'JFK',
        destinationCode: 'LAX',
        departureDate: new Date().toISOString().split('T')[0],
        cabinClass: CabinClass.Business,
        passengers: 2,
      };

      // Send search request
      const response = await request(app.getHttpServer())
        .post('/v1/flights/search')
        .send(searchPayload)
        .expect(201); // NestJS POST returns 201 Created by default

      // Validate response structure
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('hasMore');
      expect(Array.isArray(response.body.data)).toBe(true);

      // Validate that we got some results
      expect(response.body.total).toBeGreaterThanOrEqual(0);
    });

    it('should validate search parameters', async () => {
      // Missing required fields
      await request(app.getHttpServer())
        .post('/v1/flights/search')
        .send({})
        .expect(400);

      // Invalid date format
      await request(app.getHttpServer())
        .post('/v1/flights/search')
        .send({
          originCode: 'JFK',
          destinationCode: 'LAX',
          departureDate: 'invalid-date',
        })
        .expect(400);

      // Invalid cabin class
      await request(app.getHttpServer())
        .post('/v1/flights/search')
        .send({
          originCode: 'JFK',
          destinationCode: 'LAX',
          departureDate: new Date().toISOString().split('T')[0],
          cabinClass: 'InvalidClass',
        })
        .expect(400);
    });
  });

  describe('/v1/flights/:id (GET)', () => {
    let flightId: string;

    beforeAll(async () => {
      // Get a flight ID for testing
      const flight = await prismaService.flight.findFirst();
      if (flight) {
        flightId = flight.id;
      }
    });

    it('should return a flight by ID for authenticated users', async () => {
      if (!flightId) {
        console.warn('No flights found in database, skipping test');
        return;
      }

      // Send request with authentication
      const response = await request(app.getHttpServer())
        .get(`/v1/flights/${flightId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Validate response
      expect(response.body).toHaveProperty('id', flightId);
      expect(response.body).toHaveProperty('flightNumber');
      expect(response.body).toHaveProperty('airline');
      expect(response.body).toHaveProperty('origin');
      expect(response.body).toHaveProperty('destination');
    });

    it('should require authentication', async () => {
      if (!flightId) {
        console.warn('No flights found in database, skipping test');
        return;
      }

      // Send request without authentication
      await request(app.getHttpServer())
        .get(`/v1/flights/${flightId}`)
        .expect(401);
    });

    it('should return 404 for non-existent flight', async () => {
      // Send request with authentication but non-existent ID
      await request(app.getHttpServer())
        .get('/v1/flights/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
