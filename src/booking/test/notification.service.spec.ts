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
});
