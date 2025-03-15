import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { BookingStatus, Seat, CabinClass } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingResponseDto } from './dto/booking-response.dto';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import {
  CabinClassMultipliers,
  CabinClassSeats,
} from './dto/cabin-class-config.dto';
import { cabinClassConfig } from '../config/cabin-class.config';

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);
  private readonly priceMultipliers: CabinClassMultipliers;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    // Initialize price multipliers from configuration or use defaults
    this.priceMultipliers = this.initPriceMultipliers();
  }

  /**
   * Initialize price multipliers from configuration or use defaults
   * @returns Object with cabin class multipliers
   */
  private initPriceMultipliers(): CabinClassMultipliers {
    // Try to get multipliers from configuration
    const configMultipliers = this.configService.get<CabinClassMultipliers>(
      'CABIN_PRICE_MULTIPLIERS',
    );

    // Default multipliers if not found in configuration
    const defaultMultipliers = cabinClassConfig.priceMultipliers;

    // Return config values or defaults
    return configMultipliers || defaultMultipliers;
  }

  /**
   * Gets the cabin class multipliers
   * @returns The current price multipliers for each cabin class
   */
  getPriceMultipliers(): CabinClassMultipliers {
    return { ...this.priceMultipliers };
  }

  /**
   * Retrieves total seats count by cabin class with their price multipliers
   * @param flightId Flight ID to get seats for
   * @returns Total seats by cabin class with price multipliers
   */
  async getCabinSeatsWithMultipliers(
    flightId: string,
  ): Promise<CabinClassSeats> {
    const seats = await this.prisma.seat.groupBy({
      by: ['cabin'],
      where: { flightId },
      _count: { id: true },
    });

    const result: CabinClassSeats = {} as CabinClassSeats;

    // Populate result with all cabin classes and their multipliers
    Object.values(CabinClass).forEach((cabinClass) => {
      const cabinSeats = seats.find((s) => s.cabin === cabinClass);
      result[cabinClass] = {
        seats: cabinSeats ? cabinSeats._count.id : 0,
        multiplier: this.priceMultipliers[cabinClass],
      };
    });

    return result;
  }

  /**
   * Generates a unique booking reference code
   * @returns A unique booking reference code
   */
  private generateBookingReference(): string {
    // Generate a random 6-character alphanumeric code
    return randomBytes(3).toString('hex').toUpperCase();
  }

  /**
   * Validates seats for booking
   * @param flightId The ID of the flight
   * @param seatNumbers Array of seat numbers to book
   * @param selectedCabin Cabin class
   * @returns Array of Seat entities
   */
  private async validateSeats(
    flightId: string,
    seatNumbers: string[],
    selectedCabin: CabinClass,
  ): Promise<Seat[]> {
    // Find the seats on the flight
    const seats = await this.prisma.seat.findMany({
      where: {
        flightId,
        seatNumber: { in: seatNumbers },
        cabin: selectedCabin as CabinClass,
      },
    });

    // Validate that all requested seats exist
    if (seats.length !== seatNumbers.length) {
      throw new BadRequestException(
        `One or more seats do not exist or are not in the requested cabin class`,
      );
    }

    // Check if any seats are already booked
    const bookedSeats = await this.prisma.seat.findMany({
      where: {
        flightId,
        seatNumber: { in: seatNumbers },
        bookings: { some: {} }, // Seats that have any bookings
      },
    });

    if (bookedSeats.length > 0) {
      const bookedSeatNumbers = bookedSeats.map((seat) => seat.seatNumber);
      throw new BadRequestException(
        `The following seats are already booked: ${bookedSeatNumbers.join(
          ', ',
        )}`,
      );
    }

    // Check if any seats have active locks
    const lockedSeats = await this.prisma.seat.findMany({
      where: {
        flightId,
        seatNumber: { in: seatNumbers },
        seatLocks: {
          some: {
            status: 'Active',
            expiresAt: { gt: new Date() }, // Active locks that haven't expired
          },
        },
      },
    });

    if (lockedSeats.length > 0) {
      const lockedSeatNumbers = lockedSeats.map((seat) => seat.seatNumber);
      throw new BadRequestException(
        `The following seats are temporarily unavailable: ${lockedSeatNumbers.join(
          ', ',
        )}`,
      );
    }

    return seats;
  }

  /**
   * Calculate total price for a booking
   * @param flightId Flight ID
   * @param seatCount Number of seats
   * @param selectedCabin Cabin class
   * @returns Total price
   */
  private async calculateTotalPrice(
    flightId: string,
    seatCount: number,
    selectedCabin: string,
  ): Promise<number> {
    const flight = await this.prisma.flight.findUnique({
      where: { id: flightId },
      select: { basePrice: true, totalSeats: true },
    });

    if (!flight) {
      throw new NotFoundException(`Flight with ID ${flightId} not found`);
    }

    // Use the price multiplier from the instance property
    const multiplier = this.priceMultipliers[selectedCabin as CabinClass];
    const totalPrice = flight.basePrice * multiplier * seatCount;

    return parseFloat(totalPrice.toFixed(2)); // Ensure 2 decimal places
  }

  /**
   * Creates a new booking
   * @param userId User ID from auth context
   * @param createBookingDto Booking creation data
   * @returns Created booking
   */
  async createBooking(
    userId: string,
    createBookingDto: CreateBookingDto,
  ): Promise<BookingResponseDto> {
    const { flightId, selectedCabin, passengerDetails, seatNumbers } =
      createBookingDto;

    try {
      // Get user profile
      const userProfile = await this.prisma.userProfile.findUnique({
        where: { userId },
      });

      if (!userProfile) {
        throw new NotFoundException(
          `User profile not found for user ${userId}`,
        );
      }

      // Validate seats and check availability
      const seats = await this.validateSeats(
        flightId,
        seatNumbers,
        selectedCabin,
      );

      // Calculate total price
      const totalAmount = await this.calculateTotalPrice(
        flightId,
        seatNumbers.length,
        selectedCabin,
      );

      // Create the booking with a transaction to ensure atomicity
      const result = await this.prisma.$transaction(async (prisma) => {
        // Generate a unique booking reference
        const bookingReference = this.generateBookingReference();

        // Create the booking
        const booking = await prisma.booking.create({
          data: {
            bookingReference,
            userProfileId: userProfile.id,
            flightId,
            passengerDetails: passengerDetails as any, // Type assertion needed for Prisma Json type
            selectedCabin,
            totalAmount,
            status: BookingStatus.Pending,
            bookedSeats: {
              connect: seats.map((seat) => ({ id: seat.id })),
            },
          },
          include: {
            bookedSeats: true,
          },
        });

        // Create locks for the seats
        const lockExpiry = new Date();
        const lockDurationMinutes = this.configService.get<number>(
          'SEAT_LOCK_EXPIRY_MINUTES',
          15,
        );
        lockExpiry.setMinutes(lockExpiry.getMinutes() + lockDurationMinutes); // Configurable lock duration

        // Create locks for each seat
        await Promise.all(
          seats.map((seat) =>
            prisma.seatLock.create({
              data: {
                flightId,
                seatId: seat.id,
                sessionId: userId,
                expiresAt: lockExpiry,
                status: 'Active',
              },
            }),
          ),
        );

        return booking;
      });

      // Extract the seat numbers for the response
      const bookedSeatNumbers = result.bookedSeats.map(
        (seat) => seat.seatNumber,
      );

      // Return the booking details
      return BookingResponseDto.fromEntity(result, bookedSeatNumbers);
    } catch (error) {
      this.logger.error(
        `Error creating booking: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Finds a booking by ID
   * @param id Booking ID
   * @returns Booking information
   */
  async findBookingById(id: string): Promise<BookingResponseDto> {
    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id },
        include: {
          bookedSeats: true,
        },
      });

      if (!booking) {
        throw new NotFoundException(`Booking with ID ${id} not found`);
      }

      const bookedSeatNumbers = booking.bookedSeats.map(
        (seat) => seat.seatNumber,
      );
      return BookingResponseDto.fromEntity(booking, bookedSeatNumbers);
    } catch (error) {
      this.logger.error(`Error finding booking: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Finds bookings for a specific user
   * @param userId User ID
   * @returns Array of bookings
   */
  async findUserBookings(userId: string): Promise<BookingResponseDto[]> {
    try {
      // Get user profile
      const userProfile = await this.prisma.userProfile.findUnique({
        where: { userId },
      });

      if (!userProfile) {
        throw new NotFoundException(
          `User profile not found for user ${userId}`,
        );
      }

      const bookings = await this.prisma.booking.findMany({
        where: {
          userProfileId: userProfile.id,
        },
        include: {
          bookedSeats: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return bookings.map((booking) => {
        const bookedSeatNumbers = booking.bookedSeats.map(
          (seat) => seat.seatNumber,
        );
        return BookingResponseDto.fromEntity(booking, bookedSeatNumbers);
      });
    } catch (error) {
      this.logger.error(
        `Error finding user bookings: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Cancels a booking
   * @param id Booking ID
   * @param userId User ID
   * @param cancellationReason Reason for cancellation
   * @returns Updated booking
   */
  async cancelBooking(
    id: string,
    userId: string,
    cancellationReason: string,
  ): Promise<BookingResponseDto> {
    try {
      // Verify the booking exists and belongs to the user
      const userProfile = await this.prisma.userProfile.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!userProfile) {
        throw new NotFoundException(
          `User profile not found for user ${userId}`,
        );
      }

      const booking = await this.prisma.booking.findFirst({
        where: {
          id,
          userProfileId: userProfile.id,
        },
        include: {
          bookedSeats: true,
        },
      });

      if (!booking) {
        throw new NotFoundException(
          `Booking with ID ${id} not found or does not belong to you`,
        );
      }

      // Check if the booking can be cancelled
      if (booking.status === BookingStatus.Cancelled) {
        throw new BadRequestException('This booking is already cancelled');
      }

      // Update the booking status
      const updatedBooking = await this.prisma.$transaction(async (prisma) => {
        // Update booking status
        const updated = await prisma.booking.update({
          where: { id },
          data: {
            status: BookingStatus.Cancelled,
            cancelledAt: new Date(),
            cancellationReason,
          },
          include: {
            bookedSeats: true,
          },
        });

        // Release any active seat locks
        await prisma.seatLock.updateMany({
          where: {
            flightId: booking.flightId,
            seatId: { in: booking.bookedSeats.map((seat) => seat.id) },
            status: 'Active',
          },
          data: {
            status: 'Released',
          },
        });

        return updated;
      });

      const bookedSeatNumbers = updatedBooking.bookedSeats.map(
        (seat) => seat.seatNumber,
      );
      return BookingResponseDto.fromEntity(updatedBooking, bookedSeatNumbers);
    } catch (error) {
      this.logger.error(
        `Error cancelling booking: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
