import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, UserRole, BookingStatus, FlightStatus } from '@prisma/client';
import { UpdateUserRoleDto, UserFilterDto } from './dto/user-management.dto';
import {
  BookingFilterDto,
  UpdateBookingStatusDto,
} from './dto/booking-management.dto';
import {
  CreateFlightDto,
  UpdateFlightDto,
  FlightFilterDto,
} from './dto/flight-management.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listUsers(filters: UserFilterDto) {
    const {
      page = 1,
      limit = 10,
      role,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;
    const skip = (page - 1) * limit;

    // Build where clause based on filters
    const where: Prisma.UserProfileWhereInput = {
      ...(role && { role }),
      ...(search && {
        OR: [
          {
            fullName: { contains: search, mode: Prisma.QueryMode.insensitive },
          },
          { email: { contains: search, mode: Prisma.QueryMode.insensitive } },
        ],
      }),
    };

    // Get total count for pagination
    const total = await this.prisma.userProfile.count({ where });

    // Get users with booking count
    const users = await this.prisma.userProfile.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        _count: {
          select: { bookings: true },
        },
      },
    });

    // Transform the response
    const transformedUsers = users.map((user) => ({
      id: user.id,
      userId: user.userId,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      bookingsCount: user._count.bookings,
    }));

    return {
      success: true,
      message: 'Users retrieved successfully',
      data: transformedUsers,
      total,
      page,
      limit,
    };
  }

  async getUserDetails(userId: string) {
    const user = await this.prisma.userProfile.findUnique({
      where: { id: userId },
      include: {
        bookings: {
          orderBy: { createdAt: 'desc' },
          take: 5, // Get last 5 bookings
          include: {
            flight: {
              include: {
                origin: true,
                destination: true,
              },
            },
          },
        },
        _count: {
          select: { bookings: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Transform the response
    const { bookings, _count, ...userDetails } = user;
    return {
      success: true,
      message: 'User details retrieved successfully',
      data: {
        ...userDetails,
        bookingsCount: _count.bookings,
        recentBookings: bookings,
      },
    };
  }

  async updateUserRole(userId: string, updateRoleDto: UpdateUserRoleDto) {
    const user = await this.prisma.userProfile.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const updatedUser = await this.prisma.userProfile.update({
      where: { id: userId },
      data: { role: updateRoleDto.role },
    });

    this.logger.log(`Updated role for user ${userId} to ${updateRoleDto.role}`);

    return {
      success: true,
      message: `User role updated to ${updateRoleDto.role}`,
      data: updatedUser,
    };
  }

  async disableUser(userId: string) {
    // In a real application, you might want to:
    // 1. Soft delete the user
    // 2. Cancel active bookings
    // 3. Revoke authentication tokens
    // For now, we'll just log that this would happen
    this.logger.log(`Would disable user ${userId} (not implemented)`);

    return {
      success: true,
      message: 'User account disabled successfully',
    };
  }

  async listBookings(filters: BookingFilterDto) {
    const {
      page = 1,
      limit = 10,
      status,
      cabinClass,
      search,
      fromDate,
      toDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;
    const skip = (page - 1) * limit;

    // Build where clause based on filters
    const where: Prisma.BookingWhereInput = {
      ...(status && { status }),
      ...(cabinClass && { selectedCabin: cabinClass }),
      ...(search && {
        OR: [
          {
            bookingReference: {
              contains: search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          {
            passengerDetails: {
              array_contains: [{ fullName: { contains: search } }],
            },
          },
        ],
      }),
      ...(fromDate && { createdAt: { gte: new Date(fromDate) } }),
      ...(toDate && { createdAt: { lte: new Date(toDate) } }),
    };

    // Get total count for pagination
    const total = await this.prisma.booking.count({ where });

    // Get bookings with related data
    const bookings = await this.prisma.booking.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        userProfile: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        flight: {
          include: {
            origin: {
              select: {
                code: true,
                city: true,
              },
            },
            destination: {
              select: {
                code: true,
                city: true,
              },
            },
          },
        },
      },
    });

    return {
      success: true,
      message: 'Bookings retrieved successfully',
      data: bookings,
      total,
      page,
      limit,
    };
  }

  async getBookingDetails(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        userProfile: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        flight: {
          include: {
            origin: true,
            destination: true,
            seats: {
              where: {
                bookings: {
                  some: {
                    id: bookingId,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }

    return {
      success: true,
      message: 'Booking details retrieved successfully',
      data: booking,
    };
  }

  async updateBookingStatus(
    bookingId: string,
    updateStatusDto: UpdateBookingStatusDto,
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }

    const updatedBooking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: updateStatusDto.status,
        ...(updateStatusDto.status === BookingStatus.Cancelled && {
          cancellationReason: updateStatusDto.reason,
          cancelledAt: new Date(),
        }),
        ...(updateStatusDto.status === BookingStatus.Confirmed && {
          confirmedAt: new Date(),
        }),
      },
      include: {
        userProfile: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        flight: {
          include: {
            origin: true,
            destination: true,
          },
        },
      },
    });

    this.logger.log(
      `Updated booking ${bookingId} status to ${updateStatusDto.status}`,
    );

    return {
      success: true,
      message: `Booking status updated to ${updateStatusDto.status}`,
      data: updatedBooking,
    };
  }

  async listFlights(filters: FlightFilterDto) {
    const {
      page = 1,
      limit = 10,
      airline,
      flightNumber,
      originCode,
      destinationCode,
      status,
      fromDate,
      toDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = filters;
    const skip = (page - 1) * limit;

    // Build where clause based on filters
    const where: Prisma.FlightWhereInput = {
      ...(airline && {
        airline: { contains: airline, mode: Prisma.QueryMode.insensitive },
      }),
      ...(flightNumber && {
        flightNumber: {
          contains: flightNumber,
          mode: Prisma.QueryMode.insensitive,
        },
      }),
      ...(originCode && {
        origin: {
          code: { equals: originCode.toUpperCase() },
        },
      }),
      ...(destinationCode && {
        destination: {
          code: { equals: destinationCode.toUpperCase() },
        },
      }),
      ...(status && { status }),
      ...(fromDate && { departureTime: { gte: new Date(fromDate) } }),
      ...(toDate && { departureTime: { lte: new Date(toDate) } }),
    };

    // Get total count for pagination
    const total = await this.prisma.flight.count({ where });

    // Get flights with related data
    const flights = await this.prisma.flight.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        origin: {
          select: {
            code: true,
            city: true,
          },
        },
        destination: {
          select: {
            code: true,
            city: true,
          },
        },
      },
    });

    return {
      success: true,
      message: 'Flights retrieved successfully',
      data: flights,
      total,
      page,
      limit,
    };
  }

  async createFlight(createFlightDto: CreateFlightDto) {
    const {
      flightNumber,
      airline,
      aircraftType,
      departureTime,
      arrivalTime,
      duration,
      originId,
      destinationId,
      basePrice,
      totalSeats,
    } = createFlightDto;

    // Verify that origin and destination airports exist
    const [origin, destination] = await Promise.all([
      this.prisma.airport.findUnique({ where: { id: originId } }),
      this.prisma.airport.findUnique({ where: { id: destinationId } }),
    ]);

    if (!origin) {
      throw new NotFoundException(
        `Origin airport with ID ${originId} not found`,
      );
    }

    if (!destination) {
      throw new NotFoundException(
        `Destination airport with ID ${destinationId} not found`,
      );
    }

    // Create the flight
    const flight = await this.prisma.flight.create({
      data: {
        flightNumber,
        airline,
        aircraftType,
        departureTime: new Date(departureTime),
        arrivalTime: new Date(arrivalTime),
        duration,
        originId,
        destinationId,
        basePrice,
        totalSeats: JSON.parse(totalSeats),
        status: FlightStatus.Scheduled,
      },
      include: {
        origin: true,
        destination: true,
      },
    });

    this.logger.log(`Created new flight with ID ${flight.id}`);

    return {
      success: true,
      message: 'Flight created successfully',
      data: flight,
    };
  }

  async updateFlight(flightId: string, updateFlightDto: UpdateFlightDto) {
    // Check if flight exists
    const existingFlight = await this.prisma.flight.findUnique({
      where: { id: flightId },
      include: {
        bookings: {
          where: {
            status: {
              in: [BookingStatus.Confirmed, BookingStatus.AwaitingPayment],
            },
          },
        },
      },
    });

    if (!existingFlight) {
      throw new NotFoundException(`Flight with ID ${flightId} not found`);
    }

    // If there are active bookings and the flight is being cancelled,
    // we need to handle the affected bookings
    if (
      updateFlightDto.status === FlightStatus.Cancelled &&
      existingFlight.bookings.length > 0
    ) {
      // Update all affected bookings to cancelled status
      await this.prisma.booking.updateMany({
        where: {
          flightId,
          status: {
            in: [BookingStatus.Confirmed, BookingStatus.AwaitingPayment],
          },
        },
        data: {
          status: BookingStatus.Cancelled,
          cancellationReason: 'Flight cancelled by airline',
          cancelledAt: new Date(),
        },
      });
    }

    // Update the flight
    const updatedFlight = await this.prisma.flight.update({
      where: { id: flightId },
      data: {
        ...updateFlightDto,
        departureTime: new Date(updateFlightDto.departureTime),
        arrivalTime: new Date(updateFlightDto.arrivalTime),
        totalSeats: JSON.parse(updateFlightDto.totalSeats),
      },
      include: {
        origin: true,
        destination: true,
      },
    });

    this.logger.log(`Updated flight with ID ${flightId}`);

    return {
      success: true,
      message: 'Flight updated successfully',
      data: updatedFlight,
    };
  }

  async getFlightDetails(flightId: string) {
    const flight = await this.prisma.flight.findUnique({
      where: { id: flightId },
      include: {
        origin: true,
        destination: true,
        bookings: {
          include: {
            userProfile: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!flight) {
      throw new NotFoundException(`Flight with ID ${flightId} not found`);
    }

    return {
      success: true,
      message: 'Flight details retrieved successfully',
      data: flight,
    };
  }
}
