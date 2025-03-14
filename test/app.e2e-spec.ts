import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let configService: ConfigService;

  const mockPrismaService = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    onModuleInit: jest.fn().mockResolvedValue(undefined),
    onModuleDestroy: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';
    process.env.API_PREFIX = 'api';
    process.env.API_VERSION = '1';
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/flightsbooking_test';
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRATION = '1h';
    process.env.STRIPE_SECRET_KEY = 'test_stripe_key';
    process.env.STRIPE_WEBHOOK_SECRET = 'test_webhook_secret';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_KEY = 'test-key';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication({
      logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });
    configService = moduleFixture.get<ConfigService>(ConfigService);

    // Configure app using values from ConfigService
    const apiPrefix = configService.get('API_PREFIX');
    const apiVersion = configService.get('API_VERSION');

    // Configure app the same way as in main.ts
    app.useGlobalPipes(new ValidationPipe({ transform: true }));

    app.setGlobalPrefix(apiPrefix);

    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: String(apiVersion),
    });

    app.enableCors();

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    const apiPrefix = configService.get('API_PREFIX');
    const apiVersion = configService.get('API_VERSION');

    return request(app.getHttpServer())
      .get(`/${apiPrefix}/v${apiVersion}/health`)
      .expect(200)
      .expect('Hello World!');
  });
});
