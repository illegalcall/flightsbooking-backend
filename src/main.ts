// Setup crypto polyfill for @nestjs/schedule
import { setupCryptoPolyfill } from './utils/crypto-polyfill';
setupCryptoPolyfill();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import {
  Logger,
  ValidationPipe,
  VersioningType,
  BadRequestException,
} from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Env } from './config/env.schema';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    // Enable raw body access for Stripe webhooks
    bodyParser: false,
  });

  // Get config service
  const configService = app.get(ConfigService<Env>);
  const logger = new Logger('Bootstrap');

  // Get webhook paths from configuration (comma-separated paths)
  const webhookPathsConfig = configService.get(
    'WEBHOOK_PATHS',
    '/payment/webhook',
  );

  // Validate webhook paths configuration
  if (!webhookPathsConfig) {
    throw new Error(
      'WEBHOOK_PATHS environment variable is required but not set',
    );
  }

  const webhookPaths = webhookPathsConfig.split(',').map((path) => path.trim());

  // Ensure all webhook paths are valid
  for (const path of webhookPaths) {
    if (!path.startsWith('/')) {
      throw new Error(
        `Invalid webhook path: ${path}. Webhook paths must start with '/'`,
      );
    }

    if (path.includes('..') || path.includes('//')) {
      throw new Error(
        `Suspicious webhook path detected: ${path}. Path contains potentially unsafe patterns.`,
      );
    }
  }

  // Ensure webhook secret is configured for each service that uses webhooks
  // For now we're just checking Stripe as it's the only webhook consumer
  const stripeWebhookSecret = configService.get('STRIPE_WEBHOOK_SECRET');
  if (!stripeWebhookSecret) {
    throw new Error(
      'STRIPE_WEBHOOK_SECRET is required for webhook security but not set',
    );
  }

  logger.log(
    `Configured webhook paths with raw body access: ${webhookPaths.join(', ')}`,
  );

  // Configure body parsers
  app.use(
    bodyParser.json({
      verify: (req: any, res, buf) => {
        // Check if request URL matches any configured webhook path
        if (
          req.originalUrl &&
          webhookPaths.some((path) => req.originalUrl.includes(path))
        ) {
          // Make raw body available for webhook signature verification
          req.rawBody = buf;
          logger.debug(
            `Raw body attached to request for path: ${req.originalUrl}`,
          );
        }
      },
    }),
  );
  app.use(bodyParser.urlencoded({ extended: true }));

  // Enable validation pipe
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  // Configure API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    prefix: configService.get('API_PREFIX'),
    defaultVersion: String(configService.get('API_VERSION')),
  });

  // Configure Swagger
  const config = new DocumentBuilder()
    .setTitle('Flights Booking API')
    .setDescription('The Flights Booking API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // Enable CORS
  app.enableCors();

  const port = configService.get('PORT');
  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(
    `Swagger documentation is available at: http://localhost:${port}/docs`,
  );
}

bootstrap();
