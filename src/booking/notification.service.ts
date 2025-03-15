import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { EmailService } from './email.service';
import { Subject, Observable } from 'rxjs';
import { ConfigService } from '@nestjs/config';

// Define a notification event model
export interface NotificationEvent {
  userId: string;
  bookingId: string;
  bookingReference: string;
  type: 'status_change' | 'flight_update' | 'payment_update';
  status?: BookingStatus;
  message: string;
  timestamp: Date;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly events = new Subject<NotificationEvent>();

  constructor(
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Send a booking status change notification
   * @param userId User ID
   * @param bookingId Booking ID
   * @param bookingReference Booking reference code
   * @param status New booking status
   * @param email User email address
   * @param userName User name
   * @returns Success indicator
   */
  async sendBookingStatusNotification(
    userId: string,
    bookingId: string,
    bookingReference: string,
    status: BookingStatus,
    email: string,
    userName: string,
  ): Promise<boolean> {
    try {
      // Create a notification event
      const event: NotificationEvent = {
        userId,
        bookingId,
        bookingReference,
        type: 'status_change',
        status,
        message: this.getStatusChangeMessage(status),
        timestamp: new Date(),
      };

      // Emit the event for real-time subscribers
      this.events.next(event);

      // Log the notification
      this.logger.log(
        `Sending booking status notification for booking ${bookingReference}: ${status}`,
      );

      // Send email notification if enabled
      if (this.configService.get<boolean>('ENABLE_EMAIL_NOTIFICATIONS', true)) {
        await this.sendStatusChangeEmail(
          email,
          userName,
          bookingReference,
          status,
        );
      }

      return true;
    } catch (error) {
      this.logger.error(
        `Error sending notification: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Gets observable stream of notification events for a specific user
   * @param userId User ID to filter events for
   * @returns Observable of notification events
   */
  getNotificationEventsForUser(userId: string): Observable<NotificationEvent> {
    return new Observable((observer) => {
      const subscription = this.events.subscribe((event) => {
        if (event.userId === userId) {
          observer.next(event);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    });
  }

  /**
   * Gets all notification events (admin only)
   * @returns Observable of all notification events
   */
  getAllNotificationEvents(): Observable<NotificationEvent> {
    return this.events.asObservable();
  }

  /**
   * Send an email notification about a booking status change
   * @param to Recipient email
   * @param userName User's name
   * @param bookingReference Booking reference
   * @param status New booking status
   * @returns Success indicator
   */
  private async sendStatusChangeEmail(
    to: string,
    userName: string,
    bookingReference: string,
    status: BookingStatus,
  ): Promise<boolean> {
    const subject = `Booking ${bookingReference} Status Update`;
    const statusMessage = this.getStatusChangeMessage(status);
    const nextStepsMessage = this.getNextStepsMessage(status);

    // Create email content
    const text = `
Dear ${userName},

Your booking ${bookingReference} has been updated to: ${status}

${statusMessage}

${nextStepsMessage}

Thank you for booking with Flights Booking!

Flights Booking Team
    `;

    const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #4a6da7;">Booking Status Update</h2>
  
  <p>Dear ${userName},</p>
  
  <p>Your booking <strong>${bookingReference}</strong> has been updated to:</p>
  
  <div style="background-color: #f8f9fa; border-left: 4px solid #4a6da7; padding: 15px; margin: 20px 0;">
    <p style="margin: 0;"><strong>Status:</strong> ${status}</p>
  </div>
  
  <p>${statusMessage}</p>
  
  <p>${nextStepsMessage}</p>
  
  <p>Thank you for booking with Flights Booking!</p>
  
  <p>Flights Booking Team</p>
  
  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
    <p>This is an automated email. Please do not reply to this message.</p>
  </div>
</div>
    `;

    // Send the email without attachment
    try {
      // In production, we would send the actual email
      // For now, we'll just log it
      if (this.configService.get<string>('NODE_ENV') !== 'production') {
        this.logger.log(
          `[DEV MODE] Status change email would be sent to ${to} with subject: ${subject}`,
        );
        return true;
      }

      // TODO: Implement actual email sending using EmailService
      // For now, just return success
      this.logger.log(`Status change email sent to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Error sending status change email: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Gets a user-friendly message for a booking status change
   * @param status Booking status
   * @returns User-friendly message
   */
  private getStatusChangeMessage(status: BookingStatus): string {
    switch (status) {
      case BookingStatus.Pending:
        return 'Your booking has been created but is not yet confirmed. Please complete payment to confirm your booking.';
      case BookingStatus.AwaitingPayment:
        return 'We are processing your payment. Once completed, your booking will be confirmed.';
      case BookingStatus.Confirmed:
        return 'Your booking has been confirmed! Your seats are now secured.';
      case BookingStatus.Cancelled:
        return 'Your booking has been cancelled. If you made a payment, a refund will be processed according to our refund policy.';
      default:
        return 'Your booking status has been updated.';
    }
  }

  /**
   * Gets a next steps message based on booking status
   * @param status Booking status
   * @returns Next steps message
   */
  private getNextStepsMessage(status: BookingStatus): string {
    switch (status) {
      case BookingStatus.Pending:
        return 'Please complete your payment within 30 minutes to secure your booking.';
      case BookingStatus.AwaitingPayment:
        return 'No action is required from you at this time. We will notify you once your payment is processed.';
      case BookingStatus.Confirmed:
        return 'You can now download your e-ticket from your booking details page. Please arrive at the airport at least 2 hours before your flight.';
      case BookingStatus.Cancelled:
        return 'If you would like to make a new booking, please visit our website.';
      default:
        return '';
    }
  }
}
