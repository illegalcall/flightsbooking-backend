import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { FlightStatusService } from '../src/flight/flight-status.service';

describe('FlightStatusController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  // Create a mock for the FlightStatusService
  const mockFlightStatusService = {
    manuallyUpdateFlightStatuses: jest.fn().mockResolvedValue({
      message: 'Flight status update job executed',
    }),
    updateFlightStatuses: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FlightStatusService)
      .useValue(mockFlightStatusService)
      .compile();

    app = moduleFixture.createNestApplication();
    prismaService = moduleFixture.get<PrismaService>(PrismaService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/flight-status/update (POST)', () => {
    it('should trigger flight status updates and return success message', async () => {
      const response = await request(app.getHttpServer())
        .post('/flight-status/update')
        .expect(201);

      expect(response.body).toEqual({
        message: 'Flight status update job executed',
      });

      // Verify the service method was called
      expect(
        mockFlightStatusService.manuallyUpdateFlightStatuses,
      ).toHaveBeenCalled();
    });
  });
});
