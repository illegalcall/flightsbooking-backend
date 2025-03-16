import {
  Controller,
  Get,
  Param,
  UseGuards,
  Request,
  Sse,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { NotificationService, NotificationEvent } from './notification.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

interface SseMessageEvent {
  data: NotificationEvent;
}

@ApiTags('notifications')
@Controller({
  path: 'notifications',
  version: '1',
})
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(private readonly notificationService: NotificationService) {}

  @Sse('events')
  @ApiOperation({
    summary: 'Subscribe to notification events for the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'Server-sent events stream',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            bookingId: { type: 'string' },
            bookingReference: { type: 'string' },
            type: {
              type: 'string',
              enum: ['status_change', 'flight_update', 'payment_update'],
            },
            status: {
              type: 'string',
              enum: ['Pending', 'AwaitingPayment', 'Confirmed', 'Cancelled'],
            },
            message: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  events(@Request() req): Observable<SseMessageEvent> {
    const userId = req.user.sub;
    this.logger.log(`User ${userId} subscribed to notifications`);

    return this.notificationService
      .getNotificationEventsForUser(userId)
      .pipe(map((event) => ({ data: event })));
  }

  @Sse('admin/events')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Admin: Subscribe to all notification events' })
  @ApiResponse({
    status: 200,
    description: 'Server-sent events stream for all users',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Requires admin role' })
  adminEvents(): Observable<SseMessageEvent> {
    this.logger.log('Admin subscribed to all notifications');

    return this.notificationService
      .getAllNotificationEvents()
      .pipe(map((event) => ({ data: event })));
  }
}
