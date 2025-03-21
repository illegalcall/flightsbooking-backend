import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BookingStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { bookingConfig } from '../config/booking.config';
import { NotificationService } from './notification.service';

@Injectable()
export class BookingExpirationService {
  private readonly logger = new Logger(BookingExpirationService.name);
  private readonly pendingBookingExpiryMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
  ) {
    // Get configuration for booking expiry and validate it
    const configValue = this.configService.get<number | string>(
      'PENDING_BOOKING_EXPIRY_MINUTES',
    );

    // Use the validation function from the config to ensure a valid value
    this.pendingBookingExpiryMinutes =
      bookingConfig.validatePendingBookingExpiry(
        configValue !== undefined
          ? configValue
          : bookingConfig.pendingBookingExpiryMinutes,
      );

    this.logger.log(
      `Pending booking expiry set to ${this.pendingBookingExpiryMinutes} minutes`,
    );
  }

  /**
   * Runs every 5 minutes to cleanup expired pending bookings
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleExpiredBookings() {
    this.logger.log('Running expired bookings cleanup job');

    try {
      // Calculate the expiry threshold time
      const expiryThreshold = new Date();
      expiryThreshold.setMinutes(
        expiryThreshold.getMinutes() - this.pendingBookingExpiryMinutes,
      );

      // Find all pending bookings older than the threshold
      const expiredBookings = await this.prisma.booking.findMany({
        where: {
          status: BookingStatus.Pending,
          createdAt: { lt: expiryThreshold },
        },
        include: {
          bookedSeats: true,
        },
      });

      if (expiredBookings.length === 0) {
        this.logger.log('No expired bookings found');
        return;
      }

      this.logger.log(
        `Found ${expiredBookings.length} expired bookings to process`,
      );

      // Process each expired booking in a transaction
      for (const booking of expiredBookings) {
        await this.prisma.$transaction(async (prisma) => {
          // Update booking status to Cancelled
          await prisma.booking.update({
            where: { id: booking.id },
            data: {
              status: BookingStatus.Cancelled,
              cancelledAt: new Date(),
              cancellationReason:
                'Booking expired due to payment not received in time',
            },
          });

          // Send notification to the user
          const userProfile = await prisma.userProfile.findUnique({
            where: { id: booking.userProfileId },
          });

          if (userProfile) {
            await this.notificationService.sendBookingStatusNotification(
              userProfile.userId,
              booking.id,
              booking.bookingReference,
              BookingStatus.Cancelled,
              userProfile.email,
              userProfile.fullName,
              'Your booking has been cancelled because the payment time limit has expired.',
            );
          }

          // Release any active seat locks
          await prisma.seatLock.updateMany({
            where: {
              flightId: booking.flightId,
              seatId: { in: booking.bookedSeats.map((seat) => seat.id) },
              status: 'Active',
            },
            data: {
              status: 'Released',
            },
          });

          this.logger.log(
            `Cancelled expired booking ${booking.id} (reference: ${booking.bookingReference})`,
          );
        });
      }

      this.logger.log(
        `Successfully processed ${expiredBookings.length} expired bookings`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing expired bookings: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Manually run the expired bookings cleanup (for testing or admin use)
   */
  async manuallyCleanupExpiredBookings() {
    await this.handleExpiredBookings();
    return { message: 'Expired bookings cleanup completed' };
  }
}
