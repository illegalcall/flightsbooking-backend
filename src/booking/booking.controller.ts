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

@ApiTags('bookings')
@Controller({
  path: 'bookings',
  version: '1',
})
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class BookingController {
  private readonly logger = new Logger(BookingController.name);

  constructor(private readonly bookingService: BookingService) {}

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
}
