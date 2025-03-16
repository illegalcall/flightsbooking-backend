import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from '../notification.service';
import { EmailService } from '../email.service';
import { ConfigService } from '@nestjs/config';
import { BookingStatus } from '@prisma/client';
import { Observable } from 'rxjs';

describe('NotificationService', () => {
  let service: NotificationService;
  let emailService: EmailService;
  let configService: ConfigService;

  const mockEmailService = {
    sendETicket: jest.fn().mockResolvedValue(true),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue: any) => {
      if (key === 'NODE_ENV') return 'test';
      if (key === 'ENABLE_EMAIL_NOTIFICATIONS') return true;
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    emailService = module.get<EmailService>(EmailService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendBookingStatusNotification', () => {
    it('should send a notification for a booking status change', async () => {
      // Setup
      const userId = 'test-user-id';
      const bookingId = 'test-booking-id';
      const bookingReference = 'ABC123';
      const status = BookingStatus.Confirmed;
      const email = 'test@example.com';
      const userName = 'Test User';

      // Execute
      const result = await service.sendBookingStatusNotification(
        userId,
        bookingId,
        bookingReference,
        status,
        email,
        userName,
      );

      // Assert
      expect(result).toBeTruthy();
      // Check that the configService was called to check for email notifications
      expect(configService.get).toHaveBeenCalledWith(
        'ENABLE_EMAIL_NOTIFICATIONS',
        true,
      );
    });

    it('should handle errors gracefully', async () => {
      // Setup - make sendStatusChangeEmail throw an error
      jest
        .spyOn(service as any, 'sendStatusChangeEmail')
        .mockRejectedValue(new Error('Test error'));

      const userId = 'test-user-id';
      const bookingId = 'test-booking-id';
      const bookingReference = 'ABC123';
      const status = BookingStatus.Confirmed;
      const email = 'test@example.com';
      const userName = 'Test User';

      // Execute
      const result = await service.sendBookingStatusNotification(
        userId,
        bookingId,
        bookingReference,
        status,
        email,
        userName,
      );

      // Assert - should return false when there's an error
      expect(result).toBeFalsy();
    });

    it('should emit an event with the correct data', async () => {
      // Setup
      const userId = 'test-user-id';
      const bookingId = 'test-booking-id';
      const bookingReference = 'ABC123';
      const status = BookingStatus.Confirmed;
      const email = 'test@example.com';
      const userName = 'Test User';

      // Spy on the events Subject's next method
      const nextSpy = jest.spyOn(service['events'], 'next');

      // Execute
      await service.sendBookingStatusNotification(
        userId,
        bookingId,
        bookingReference,
        status,
        email,
        userName,
      );

      // Assert
      expect(nextSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          bookingId,
          bookingReference,
          type: 'status_change',
          status,
          message: expect.any(String),
          timestamp: expect.any(Date),
        }),
      );
    });

    it('should not send email when email notifications are disabled', async () => {
      // Setup
      jest.spyOn(configService, 'get').mockImplementation((key) => {
        if (key === 'ENABLE_EMAIL_NOTIFICATIONS') return false;
        return 'test';
      });

      const sendEmailSpy = jest.spyOn(service as any, 'sendStatusChangeEmail');

      // Execute
      await service.sendBookingStatusNotification(
        'userId',
        'bookingId',
        'reference',
        BookingStatus.Confirmed,
        'email',
        'name',
      );

      // Assert
      expect(sendEmailSpy).not.toHaveBeenCalled();
    });
  });

  describe('getNotificationEventsForUser', () => {
    it('should return an Observable', () => {
      const result = service.getNotificationEventsForUser('test-user-id');
      expect(result).toBeInstanceOf(Observable);
    });
  });

  describe('getAllNotificationEvents', () => {
    it('should return an Observable', () => {
      const result = service.getAllNotificationEvents();
      expect(result).toBeInstanceOf(Observable);
    });
  });

  describe('private methods', () => {
    describe('getStatusChangeMessage', () => {
      it('should return correct message for Pending status', () => {
        const message = (service as any).getStatusChangeMessage(
          BookingStatus.Pending,
        );
        expect(message).toContain('not yet confirmed');
        expect(message).toContain('complete payment');
      });

      it('should return correct message for AwaitingPayment status', () => {
        const message = (service as any).getStatusChangeMessage(
          BookingStatus.AwaitingPayment,
        );
        expect(message).toContain('processing your payment');
      });

      it('should return correct message for Confirmed status', () => {
        const message = (service as any).getStatusChangeMessage(
          BookingStatus.Confirmed,
        );
        expect(message).toContain('confirmed');
        expect(message).toContain('secured');
      });

      it('should return correct message for Cancelled status', () => {
        const message = (service as any).getStatusChangeMessage(
          BookingStatus.Cancelled,
        );
        expect(message).toContain('cancelled');
        expect(message).toContain('refund');
      });

      it('should return default message for unknown status', () => {
        const message = (service as any).getStatusChangeMessage(
          'UnknownStatus' as any,
        );
        expect(message).toBe('Your booking status has been updated.');
      });
    });

    describe('getNextStepsMessage', () => {
      it('should return correct message for Pending status', () => {
        const message = (service as any).getNextStepsMessage(
          BookingStatus.Pending,
        );
        expect(message).toContain('complete your payment');
      });

      it('should return correct message for AwaitingPayment status', () => {
        const message = (service as any).getNextStepsMessage(
          BookingStatus.AwaitingPayment,
        );
        expect(message).toContain('No action is required');
      });

      it('should return correct message for Confirmed status', () => {
        const message = (service as any).getNextStepsMessage(
          BookingStatus.Confirmed,
        );
        expect(message).toContain('download your e-ticket');
      });

      it('should return correct message for Cancelled status', () => {
        const message = (service as any).getNextStepsMessage(
          BookingStatus.Cancelled,
        );
        expect(message).toContain('new booking');
      });

      it('should return empty string for unknown status', () => {
        const message = (service as any).getNextStepsMessage(
          'UnknownStatus' as any,
        );
        expect(message).toBe('');
      });
    });

    describe('sendStatusChangeEmail', () => {
      it('should log in development mode without sending email', async () => {
        jest.spyOn(configService, 'get').mockImplementation((key) => {
          if (key === 'NODE_ENV') return 'development';
          return true;
        });

        const loggerSpy = jest.spyOn(service['logger'], 'log');

        const result = await (service as any).sendStatusChangeEmail(
          'test@example.com',
          'Test User',
          'ABC123',
          BookingStatus.Confirmed,
        );

        expect(result).toBe(true);
        expect(loggerSpy).toHaveBeenCalledWith(
          expect.stringContaining('[DEV MODE]'),
        );
      });

      it('should handle errors when sending email fails', async () => {
        jest.spyOn(configService, 'get').mockImplementation((key) => {
          if (key === 'NODE_ENV') return 'production';
          return true;
        });

        // Mock an error
        const mockError = new Error('Email sending failed');
        jest.spyOn(service['logger'], 'log').mockImplementation(() => {
          throw mockError;
        });

        const errorSpy = jest.spyOn(service['logger'], 'error');

        const result = await (service as any).sendStatusChangeEmail(
          'test@example.com',
          'Test User',
          'ABC123',
          BookingStatus.Confirmed,
        );

        expect(result).toBe(false);
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Error sending status change email'),
          expect.any(String),
        );
      });
    });
  });

  describe('event observables', () => {
    it('should filter events by userId in getNotificationEventsForUser', (done) => {
      const targetUserId = 'target-user';
      const otherUserId = 'other-user';

      // Create an event for the target user
      const targetEvent = {
        userId: targetUserId,
        bookingId: 'booking-1',
        bookingReference: 'REF1',
        type: 'status_change' as const,
        status: BookingStatus.Confirmed,
        message: 'Test message',
        timestamp: new Date(),
      };

      // Create an event for another user
      const otherEvent = {
        ...targetEvent,
        userId: otherUserId,
        bookingId: 'booking-2',
        bookingReference: 'REF2',
      };

      // Subscribe to events for target user
      const subscription = service
        .getNotificationEventsForUser(targetUserId)
        .subscribe({
          next: (event) => {
            expect(event).toEqual(targetEvent);
            expect(event.userId).toBe(targetUserId);
            subscription.unsubscribe();
            done();
          },
        });

      // Emit both events
      service['events'].next(otherEvent); // Should be filtered out
      service['events'].next(targetEvent); // Should be received by the subscriber
    });

    it('should provide all events in getAllNotificationEvents', (done) => {
      const events = [];
      const event1 = {
        userId: 'user-1',
        bookingId: 'booking-1',
        bookingReference: 'REF1',
        type: 'status_change' as const,
        status: BookingStatus.Confirmed,
        message: 'Test message 1',
        timestamp: new Date(),
      };

      const event2 = {
        userId: 'user-2',
        bookingId: 'booking-2',
        bookingReference: 'REF2',
        type: 'status_change' as const,
        status: BookingStatus.Cancelled,
        message: 'Test message 2',
        timestamp: new Date(),
      };

      const subscription = service.getAllNotificationEvents().subscribe({
        next: (event) => {
          events.push(event);
          if (events.length === 2) {
            expect(events).toContainEqual(event1);
            expect(events).toContainEqual(event2);
            subscription.unsubscribe();
            done();
          }
        },
      });

      // Emit both events
      service['events'].next(event1);
      service['events'].next(event2);
    });
  });
});
