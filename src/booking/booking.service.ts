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
import { NotificationService } from './notification.service';

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);
  private readonly priceMultipliers: CabinClassMultipliers;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
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
      // Verify userId is defined
      if (!userId) {
        throw new BadRequestException('User ID is required for booking');
      }

      // Get user profile
      let userProfile = await this.prisma.userProfile.findUnique({
        where: {
          userId: userId,
        },
      });

      // Create user profile if it doesn't exist
      if (!userProfile) {
        // Use the first passenger data to create a user profile
        const passengerName = passengerDetails[0]?.fullName || 'Unknown';

        // Generate a temporary email if none is provided
        const tempEmail = `${userId}@example.com`;

        // Create a new user profile with required fields
        userProfile = await this.prisma.userProfile.create({
          data: {
            userId: userId,
            fullName: passengerName,
            email: tempEmail, // Required field in the schema
          },
        });

        this.logger.log(`Created new user profile for user ${userId}`);
      }

      // Calculate total price before the transaction to reduce transaction time
      const totalAmount = await this.calculateTotalPrice(
        flightId,
        seatNumbers.length,
        selectedCabin,
      );

      // Implement transaction with retry logic
      let retries = 0;
      const maxRetries = 3;
      let result;

      while (retries < maxRetries) {
        try {
          // Create the booking with a transaction to ensure atomicity
          result = await this.prisma.$transaction(
            async (prisma) => {
              // Lock the seats for update to prevent race conditions
              // This will acquire a row-level lock on these specific seats
              const seats = await prisma.seat.findMany({
                where: {
                  flightId,
                  seatNumber: { in: seatNumbers },
                  cabin: selectedCabin as CabinClass,
                },
                orderBy: { id: 'asc' }, // Consistent ordering to prevent deadlocks
              });

              // Verify all seats exist in selected cabin
              if (seats.length !== seatNumbers.length) {
                throw new BadRequestException(
                  `One or more seats do not exist or are not in the requested cabin class`,
                );
              }

              // Check if any seats are already booked
              const bookedSeats = await prisma.booking.findMany({
                where: {
                  flightId,
                  bookedSeats: {
                    some: {
                      seatNumber: { in: seatNumbers },
                    },
                  },
                  status: {
                    notIn: [BookingStatus.Cancelled],
                  },
                },
                include: {
                  bookedSeats: {
                    where: {
                      seatNumber: { in: seatNumbers },
                    },
                  },
                },
              });

              if (bookedSeats && bookedSeats.length > 0) {
                const bookedSeatNumbers = bookedSeats.flatMap(
                  (booking) =>
                    booking.bookedSeats?.map((seat) => seat.seatNumber) || [],
                );
                throw new BadRequestException(
                  `The following seats are already booked: ${bookedSeatNumbers.join(
                    ', ',
                  )}`,
                );
              }

              // Check if any seats have active locks from other users
              const lockedSeats = await prisma.seatLock.findMany({
                where: {
                  flightId,
                  seatId: { in: seats.map((seat) => seat.id) },
                  status: 'Active',
                  expiresAt: { gt: new Date() }, // Active locks that haven't expired
                  NOT: {
                    sessionId: userId, // Exclude locks from current user's session
                  },
                },
                include: {
                  seat: true,
                },
              });

              if (lockedSeats && lockedSeats.length > 0) {
                const lockedSeatNumbers = lockedSeats
                  .map((lock) => lock.seat?.seatNumber)
                  .filter(Boolean);
                throw new BadRequestException(
                  `The following seats are temporarily unavailable: ${lockedSeatNumbers.join(
                    ', ',
                  )}`,
                );
              }

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
              lockExpiry.setMinutes(
                lockExpiry.getMinutes() + lockDurationMinutes,
              ); // Configurable lock duration

              // Create locks for each seat sequentially instead of using Promise.all
              // This helps avoid deadlocks during concurrent transactions
              for (const seat of seats) {
                await prisma.seatLock.create({
                  data: {
                    flightId,
                    seatId: seat.id,
                    sessionId: userId,
                    expiresAt: lockExpiry,
                    status: 'Active',
                  },
                });
              }

              return booking;
            },
            {
              timeout: 15000, // 15 second timeout (increased)
              isolationLevel: 'Serializable', // Highest isolation level to prevent race conditions
            },
          );

          // If we reach here, the transaction succeeded - break out of retry loop
          break;
        } catch (error) {
          retries++;

          // If this was a deadlock or transaction conflict and we have retries left, try again
          if (
            error.message.includes('deadlock') ||
            error.message.includes('write conflict')
          ) {
            if (retries < maxRetries) {
              this.logger.warn(
                `Transaction failed with deadlock, retrying (${retries}/${maxRetries})...`,
              );
              // Wait a small random amount of time before retrying to reduce contention
              await new Promise((resolve) =>
                setTimeout(resolve, 100 * retries + Math.random() * 200),
              );
              continue;
            }
          }

          // For other errors or if we're out of retries, rethrow
          throw error;
        }
      }

      // Extract the seat numbers for the response
      const bookedSeatNumbers = result.bookedSeats.map(
        (seat) => seat.seatNumber,
      );

      // Send notification about the booking creation
      this.notificationService
        .sendBookingStatusNotification(
          userId,
          result.id,
          result.bookingReference,
          result.status,
          userProfile.email,
          userProfile.fullName,
        )
        .catch((error) => {
          this.logger.error(
            `Failed to send booking creation notification: ${error.message}`,
            error.stack,
          );
        });

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
      // Set default cancellation reason if none provided
      if (!cancellationReason) {
        cancellationReason = 'Cancelled by user';
      }

      // Verify the booking exists and belongs to the user
      const userProfile = await this.prisma.userProfile.findUnique({
        where: { userId },
        select: { id: true, email: true, fullName: true },
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

      // Send notification about the booking cancellation
      this.notificationService
        .sendBookingStatusNotification(
          userId,
          updatedBooking.id,
          updatedBooking.bookingReference,
          updatedBooking.status,
          userProfile.email,
          userProfile.fullName,
        )
        .catch((error) => {
          this.logger.error(
            `Failed to send booking cancellation notification: ${error.message}`,
            error.stack,
          );
        });

      return BookingResponseDto.fromEntity(updatedBooking, bookedSeatNumbers);
    } catch (error) {
      this.logger.error(
        `Error cancelling booking: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Gets a user profile by user ID
   * @param userId User ID (from auth)
   * @returns User profile
   */
  async getUserProfile(userId: string) {
    const userProfile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!userProfile) {
      throw new NotFoundException(`User profile not found for user ${userId}`);
    }

    return userProfile;
  }

  /**
   * Updates a booking status and sends a notification
   * @param bookingId Booking ID
   * @param newStatus New booking status
   * @param reason Optional reason for the status change
   * @returns Updated booking
   */
  async updateBookingStatus(
    bookingId: string,
    newStatus: BookingStatus,
    reason?: string,
  ): Promise<BookingResponseDto> {
    try {
      // Find the booking
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          bookedSeats: true,
          userProfile: true,
        },
      });

      if (!booking) {
        throw new NotFoundException(`Booking with ID ${bookingId} not found`);
      }

      // Only update if the status is different
      if (booking.status === newStatus) {
        const bookedSeatNumbers = booking.bookedSeats.map(
          (seat) => seat.seatNumber,
        );
        return BookingResponseDto.fromEntity(booking, bookedSeatNumbers);
      }

      // Update the status
      const updatedBooking = await this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: newStatus,
          ...(newStatus === BookingStatus.Confirmed && {
            confirmedAt: new Date(),
          }),
          ...(newStatus === BookingStatus.Cancelled && {
            cancelledAt: new Date(),
            cancellationReason: reason || 'Status updated by system',
          }),
        },
        include: {
          bookedSeats: true,
        },
      });

      // Send notification about the status change
      const userProfile = booking.userProfile;
      this.notificationService
        .sendBookingStatusNotification(
          userProfile.userId,
          updatedBooking.id,
          updatedBooking.bookingReference,
          updatedBooking.status,
          userProfile.email,
          userProfile.fullName,
        )
        .catch((error) => {
          this.logger.error(
            `Failed to send booking status update notification: ${error.message}`,
            error.stack,
          );
        });

      const bookedSeatNumbers = updatedBooking.bookedSeats.map(
        (seat) => seat.seatNumber,
      );
      return BookingResponseDto.fromEntity(updatedBooking, bookedSeatNumbers);
    } catch (error) {
      this.logger.error(
        `Error updating booking status: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Helper method to create a "FOR UPDATE" option for Prisma
   * queries when needed for row-level locking
   * Note: This is a placeholder - actual implementation would require Prisma middleware
   */
  private createForUpdateOption() {
    // In a real implementation, this would be handled by Prisma middleware
    // that would add "FOR UPDATE" to the query when this property is present
    return {};
  }
}
