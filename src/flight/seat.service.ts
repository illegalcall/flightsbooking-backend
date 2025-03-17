import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CabinClass, SeatLockStatus } from '@prisma/client';
import { Seat } from './entities/seat.entity';
import { SeatMapDto, SeatMapResponseDto } from './dto/seat.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class SeatService {
  private readonly logger = new Logger(SeatService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all seats for a flight
   * @param flightId The flight ID
   * @param cabinClass Optional filter by cabin class
   * @returns Array of seat entities
   */
  async getSeatsForFlight(
    flightId: string,
    cabinClass?: CabinClass,
  ): Promise<Seat[]> {
    this.logger.log(`Getting seats for flight ${flightId}`);

    // First check if the flight exists
    const flightExists = await this.prisma.flight.findUnique({
      where: { id: flightId },
    });

    if (!flightExists) {
      throw new NotFoundException(`Flight with ID ${flightId} not found`);
    }

    // Get the seats with basic info
    const seats = await this.prisma.seat.findMany({
      where: {
        flightId,
        ...(cabinClass && { cabin: cabinClass }),
      },
    });

    // Return empty array if no seats found
    if (seats.length === 0) {
      return [];
    }

    // Get booking information separately
    const seatIds = seats.map((seat) => seat.id);
    const bookings = await this.prisma.booking.findMany({
      where: {
        bookedSeats: {
          some: {
            id: { in: seatIds },
          },
        },
      },
      include: {
        bookedSeats: {
          select: {
            id: true,
          },
        },
      },
    });

    // Get lock information separately
    const seatLocks = await this.prisma.seatLock.findMany({
      where: {
        seatId: { in: seatIds },
        status: SeatLockStatus.Active,
        expiresAt: { gt: new Date() },
      },
    });

    // Create a map of seat IDs to booking status
    const bookedSeatIds = new Set<string>();
    bookings.forEach((booking) => {
      booking.bookedSeats.forEach((seat) => {
        bookedSeatIds.add(seat.id);
      });
    });

    // Create a map of seat IDs to lock status
    const lockedSeatIds = new Set<string>();
    seatLocks.forEach((lock) => {
      lockedSeatIds.add(lock.seatId);
    });

    // Transform to add booking and lock status
    return seats.map((seat) => {
      const seatEntity: Seat = {
        ...seat,
        isBooked: bookedSeatIds.has(seat.id),
        isLocked: lockedSeatIds.has(seat.id),
      };

      return seatEntity;
    });
  }

  /**
   * Get seat map for a flight
   * @param flightId The flight ID
   * @returns Seat map organized by cabin class
   */
  async getSeatMap(flightId: string): Promise<SeatMapResponseDto> {
    // Get all seats for the flight
    const seats = await this.getSeatsForFlight(flightId);

    if (seats.length === 0) {
      throw new BadRequestException(
        `No seats found for flight with ID ${flightId}`,
      );
    }

    // Group seats by cabin class
    const seatsByCabin = seats.reduce<Record<string, Seat[]>>((acc, seat) => {
      if (!acc[seat.cabin]) {
        acc[seat.cabin] = [];
      }
      acc[seat.cabin].push(seat);
      return acc;
    }, {});

    // Create seat maps for each cabin class
    const seatMaps: SeatMapDto[] = [];

    for (const cabin of Object.keys(seatsByCabin)) {
      const cabinSeats = seatsByCabin[cabin];

      // Get unique rows and columns
      const rows = [
        ...new Set(cabinSeats.map((seat) => (seat.position as any).row)),
      ].sort((a: number, b: number) => a - b);

      const columns = [
        ...new Set(cabinSeats.map((seat) => (seat.position as any).col)),
      ].sort() as string[];

      seatMaps.push({
        cabin: cabin as CabinClass,
        rows: rows.length,
        columns,
        seats: cabinSeats,
      });
    }

    return {
      flightId,
      seatMaps,
    };
  }
}
