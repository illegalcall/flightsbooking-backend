import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { BookingExpirationService } from './booking-expiration.service';
import { ETicketService } from './e-ticket.service';
import { EmailService } from './email.service';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [BookingController, NotificationController],
  providers: [
    BookingService,
    BookingExpirationService,
    ETicketService,
    EmailService,
    NotificationService,
  ],
  exports: [BookingService, BookingExpirationService, NotificationService],
})
export class BookingModule {}
