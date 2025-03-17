import { Test, TestingModule } from '@nestjs/testing';
import { NotificationController } from '../notification.controller';
import {
  NotificationService,
  NotificationEvent,
} from '../notification.service';
import { Observable, of } from 'rxjs';

describe('NotificationController', () => {
  let controller: NotificationController;
  let service: NotificationService;

  const mockNotificationService = {
    getNotificationEventsForUser: jest.fn((userId: string) => {
      return of({
        userId,
        bookingId: 'test-booking-id',
        bookingReference: 'ABC123',
        type: 'status_change',
        message: 'Test notification',
        timestamp: new Date(),
      } as NotificationEvent);
    }),
    getAllNotificationEvents: jest.fn(() => {
      return of({
        userId: 'any-user',
        bookingId: 'test-booking-id',
        bookingReference: 'ABC123',
        type: 'status_change',
        message: 'Test notification',
        timestamp: new Date(),
      } as NotificationEvent);
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    controller = module.get<NotificationController>(NotificationController);
    service = module.get<NotificationService>(NotificationService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('events', () => {
    it('should return an Observable of SSE events for the user', () => {
      // Mock request object with authenticated user
      const req = {
        user: {
          userId: 'test-user-id',
        },
      };

      // Execute
      const result = controller.events(req);

      // Assert
      expect(result).toBeInstanceOf(Observable);
      expect(service.getNotificationEventsForUser).toHaveBeenCalledWith(
        'test-user-id',
      );
    });
  });

  describe('adminEvents', () => {
    it('should return an Observable of all SSE events', () => {
      // Execute
      const result = controller.adminEvents();

      // Assert
      expect(result).toBeInstanceOf(Observable);
      expect(service.getAllNotificationEvents).toHaveBeenCalled();
    });
  });
});
