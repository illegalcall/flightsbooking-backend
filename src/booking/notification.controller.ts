import {
  Controller,
  Get,
  Param,
  UseGuards,
  Request,
  Sse,
  Logger,
  UnauthorizedException,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { NotificationService, NotificationEvent } from './notification.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SupabaseService } from '../auth/supabase/supabase.service';

interface SseMessageEvent {
  data: NotificationEvent;
}

@ApiTags('notifications')
@Controller({
  path: 'notifications',
  version: '1',
})
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly supabaseService: SupabaseService,
  ) {}

  // Add a simple test endpoint
  @Get('ping')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Test endpoint to verify controller accessibility' })
  @ApiResponse({ status: 200, description: 'Controller is accessible' })
  ping(): string {
    return 'Notification controller is accessible';
  }

  @Sse('events')
  @ApiOperation({
    summary: 'Subscribe to notification events for the current user',
  })
  @ApiQuery({
    name: 'token',
    required: false,
    description:
      'JWT token (required for EventSource which cannot set headers)',
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
  async events(
    @Request() req,
    @Query('token') token?: string,
  ): Promise<Observable<SseMessageEvent>> {
    let userId;

    // First try to get user from JWT guard if available
    if (req.user?.userId) {
      userId = req.user.userId;
    }
    // Otherwise try to validate from token parameter
    else if (token) {
      try {
        const user = await this.supabaseService.verifyToken(token);
        if (user) {
          userId = user.id;
        }
      } catch (error) {
        this.logger.error(
          `Invalid token provided via query param: ${error.message}`,
        );
        throw new UnauthorizedException('Invalid token');
      }
    }

    if (!userId) {
      this.logger.error('No valid authentication provided for SSE connection');
      throw new UnauthorizedException('Authentication required');
    }

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
