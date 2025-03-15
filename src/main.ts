import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
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
  const webhookPaths = webhookPathsConfig.split(',').map((path) => path.trim());

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
