import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Request,
  BadRequestException,
  Delete,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { BookingService } from './booking.service';
import { CreateBookingDto, BookingResponseDto } from './dto';
import { BookingExpirationService } from './booking-expiration.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ETicketService } from './e-ticket.service';
import { EmailService } from './email.service';

@ApiTags('bookings')
@Controller({
  path: 'bookings',
  version: '1',
})
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class BookingController {
  private readonly logger = new Logger(BookingController.name);

  constructor(
    private readonly bookingService: BookingService,
    private readonly bookingExpirationService: BookingExpirationService,
    private readonly eTicketService: ETicketService,
    private readonly emailService: EmailService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new booking' })
  @ApiResponse({
    status: 201,
    description: 'Booking created successfully',
    type: BookingResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBody({ type: CreateBookingDto })
  async createBooking(
    @Request() req,
    @Body() createBookingDto: CreateBookingDto,
  ): Promise<BookingResponseDto> {
    try {
      // Extract the user ID from the request (set by the AuthGuard)
      const userId = req.user.sub;
      return await this.bookingService.createBooking(userId, createBookingDto);
    } catch (error) {
      this.logger.error(
        `Error in createBooking: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all bookings for the current user' })
  @ApiResponse({
    status: 200,
    description: 'List of bookings',
    type: [BookingResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserBookings(@Request() req): Promise<BookingResponseDto[]> {
    try {
      const userId = req.user.sub;
      return await this.bookingService.findUserBookings(userId);
    } catch (error) {
      this.logger.error(
        `Error in getUserBookings: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a booking by ID' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({
    status: 200,
    description: 'Booking details',
    type: BookingResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async getBookingById(@Param('id') id: string): Promise<BookingResponseDto> {
    try {
      return await this.bookingService.findBookingById(id);
    } catch (error) {
      this.logger.error(
        `Error in getBookingById: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({
    status: 200,
    description: 'Booking cancelled successfully',
    type: BookingResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async cancelBooking(
    @Request() req,
    @Param('id') id: string,
    @Body('cancellationReason') cancellationReason?: string,
  ): Promise<BookingResponseDto> {
    try {
      const userId = req.user.sub;

      if (!cancellationReason) {
        cancellationReason = 'Cancelled by user';
      }

      return await this.bookingService.cancelBooking(
        id,
        userId,
        cancellationReason,
      );
    } catch (error) {
      this.logger.error(
        `Error in cancelBooking: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post('admin/cleanup-expired')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Manually clean up expired bookings (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Cleanup process completed successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Requires admin role' })
  async cleanupExpiredBookings() {
    try {
      return await this.bookingExpirationService.manuallyCleanupExpiredBookings();
    } catch (error) {
      this.logger.error(
        `Error in cleanupExpiredBookings: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post(':id/e-ticket')
  @ApiOperation({ summary: 'Generate and send e-ticket for booking' })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({
    status: 200,
    description: 'E-ticket generated and sent successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async generateAndSendETicket(
    @Request() req,
    @Param('id') id: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const userId = req.user.sub;

      // Get user profile
      const userProfile = await this.bookingService.getUserProfile(userId);

      // Check booking exists and belongs to user
      const booking = await this.bookingService.findBookingById(id);

      if (booking.userProfileId !== userProfile.id) {
        throw new BadRequestException(
          'You do not have permission to access this booking',
        );
      }

      // Generate PDF
      const pdfPath = await this.eTicketService.generateETicket(id);

      // Send email with PDF
      const mainPassenger = booking.passengerDetails[0];
      const emailSuccess = await this.emailService.sendETicket(
        userProfile.email,
        booking.bookingReference,
        pdfPath,
        mainPassenger.fullName,
      );

      if (emailSuccess) {
        return {
          success: true,
          message: 'E-ticket generated and sent successfully',
        };
      } else {
        return {
          success: false,
          message: 'E-ticket generated but could not be sent by email',
        };
      }
    } catch (error) {
      this.logger.error(
        `Error generating e-ticket: ${error.message}`,
        error.stack,
      );

      if (error.message.includes('Cannot generate e-ticket')) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }
}
