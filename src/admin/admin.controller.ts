import {
  Controller,
  Get,
  Put,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminGuard } from './guards/admin.guard';
import {
  UpdateUserRoleDto,
  UserFilterDto,
  UserListResponseDto,
} from './dto/user-management.dto';
import {
  BookingFilterDto,
  BookingListResponseDto,
  UpdateBookingStatusDto,
} from './dto/booking-management.dto';
import {
  CreateFlightDto,
  UpdateFlightDto,
  FlightFilterDto,
  FlightListResponseDto,
} from './dto/flight-management.dto';
import { AdminResponseDto } from './dto/admin-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Admin')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'List all users with filtering and pagination' })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
    type: UserListResponseDto,
  })
  async listUsers(
    @Query() filters: UserFilterDto,
  ): Promise<UserListResponseDto> {
    return this.adminService.listUsers(filters);
  }

  @Get('users/:userId')
  @ApiOperation({
    summary: 'Get detailed user information including recent bookings',
  })
  @ApiResponse({
    status: 200,
    description: 'User details retrieved successfully',
    type: AdminResponseDto,
  })
  async getUserDetails(@Param('userId') userId: string) {
    return this.adminService.getUserDetails(userId);
  }

  @Put('users/:userId/role')
  @ApiOperation({ summary: 'Update user role' })
  @ApiResponse({
    status: 200,
    description: 'User role updated successfully',
    type: AdminResponseDto,
  })
  async updateUserRole(
    @Param('userId') userId: string,
    @Body() updateRoleDto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(userId, updateRoleDto);
  }

  @Post('users/:userId/disable')
  @ApiOperation({ summary: 'Disable user account' })
  @ApiResponse({
    status: 200,
    description: 'User account disabled successfully',
    type: AdminResponseDto,
  })
  async disableUser(@Param('userId') userId: string) {
    return this.adminService.disableUser(userId);
  }

  @Get('bookings')
  @ApiOperation({ summary: 'List all bookings with filtering and pagination' })
  @ApiResponse({
    status: 200,
    description: 'Bookings retrieved successfully',
    type: BookingListResponseDto,
  })
  async listBookings(
    @Query() filters: BookingFilterDto,
  ): Promise<BookingListResponseDto> {
    return this.adminService.listBookings(filters);
  }

  @Get('bookings/:bookingId')
  @ApiOperation({ summary: 'Get detailed booking information' })
  @ApiResponse({
    status: 200,
    description: 'Booking details retrieved successfully',
    type: AdminResponseDto,
  })
  async getBookingDetails(@Param('bookingId') bookingId: string) {
    return this.adminService.getBookingDetails(bookingId);
  }

  @Put('bookings/:bookingId/status')
  @ApiOperation({ summary: 'Update booking status' })
  @ApiResponse({
    status: 200,
    description: 'Booking status updated successfully',
    type: AdminResponseDto,
  })
  async updateBookingStatus(
    @Param('bookingId') bookingId: string,
    @Body() updateStatusDto: UpdateBookingStatusDto,
  ) {
    return this.adminService.updateBookingStatus(bookingId, updateStatusDto);
  }

  @Get('flights')
  @ApiOperation({ summary: 'List all flights with filtering and pagination' })
  @ApiResponse({
    status: 200,
    description: 'Flights retrieved successfully',
    type: FlightListResponseDto,
  })
  async listFlights(
    @Query() filters: FlightFilterDto,
  ): Promise<FlightListResponseDto> {
    return this.adminService.listFlights(filters);
  }

  @Post('flights')
  @ApiOperation({ summary: 'Create a new flight' })
  @ApiResponse({
    status: 200,
    description: 'Flight created successfully',
    type: AdminResponseDto,
  })
  async createFlight(@Body() createFlightDto: CreateFlightDto) {
    return this.adminService.createFlight(createFlightDto);
  }

  @Get('flights/:flightId')
  @ApiOperation({
    summary: 'Get detailed flight information including bookings',
  })
  @ApiResponse({
    status: 200,
    description: 'Flight details retrieved successfully',
    type: AdminResponseDto,
  })
  async getFlightDetails(@Param('flightId') flightId: string) {
    return this.adminService.getFlightDetails(flightId);
  }

  @Put('flights/:flightId')
  @ApiOperation({
    summary: 'Update flight details and handle affected bookings',
  })
  @ApiResponse({
    status: 200,
    description: 'Flight updated successfully',
    type: AdminResponseDto,
  })
  async updateFlight(
    @Param('flightId') flightId: string,
    @Body() updateFlightDto: UpdateFlightDto,
  ) {
    return this.adminService.updateFlight(flightId, updateFlightDto);
  }
}
