// Setup crypto polyfill for @nestjs/schedule
import { setupCryptoPolyfill } from './utils/crypto-polyfill';
setupCryptoPolyfill();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Env } from './config/env.schema';
import * as bodyParser from 'body-parser';
import * as express from 'express';

async function bootstrap() {
  // Create app without built-in body parser
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    bodyParser: false,
  });

  // Get config service
  const configService = app.get(ConfigService<Env>);
  const logger = new Logger('Bootstrap');

  // Verify Stripe webhook secret is configured
  const stripeWebhookSecret = configService.get<string>(
    'STRIPE_WEBHOOK_SECRET',
  );
  if (!stripeWebhookSecret) {
    throw new Error(
      'STRIPE_WEBHOOK_SECRET is required for webhook security but not set',
    );
  }

  // Get API versioning info
  const apiPrefix = configService.get('API_PREFIX', 'api');
  const apiVersion = String(configService.get('API_VERSION', '1'));

  // Define webhook paths we want to match
  const webhookPaths = [
    `/v${apiVersion}/payments/webhook`,
    `/${apiPrefix}/v${apiVersion}/payments/webhook`,
    `/v${apiVersion}/payment/webhook`,
    `/${apiPrefix}/v${apiVersion}/payment/webhook`,
  ];

  logger.log(`Configuring webhook paths: ${webhookPaths.join(', ')}`);

  // Register the raw body parser for webhook endpoints
  for (const path of webhookPaths) {
    logger.log(`Setting up raw body parser for path: ${path}`);
    app.use(
      path,
      express.raw({
        type: ['application/json', 'application/json; charset=utf-8'],
        limit: '10mb',
      }),
    );
  }

  // Default JSON parser for all other routes
  app.use(bodyParser.json());

  // Add urlencoded parser for form data
  app.use(bodyParser.urlencoded({ extended: true }));

  // Enable validation pipe
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  // Configure API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    prefix: apiPrefix,
    defaultVersion: apiVersion,
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
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  });

  const port = configService.get('PORT', 4000);
  await app.listen(port, '0.0.0.0');

  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(
    `Swagger documentation is available at: http://localhost:${port}/docs`,
  );
}

bootstrap();
