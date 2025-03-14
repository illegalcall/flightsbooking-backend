import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Flight, CabinClass, Prisma } from '@prisma/client';
import { SearchFlightDto } from './dto/search-flight.dto';

@Injectable()
export class FlightService {
  private readonly logger = new Logger(FlightService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find a single flight by ID
   * @param id The flight ID
   * @returns The flight or throws NotFoundException
   */
  async findOne(id: string): Promise<Flight> {
    try {
      const flight = await this.prisma.flight.findUnique({
        where: { id },
        include: {
          origin: true,
          destination: true,
        },
      });

      if (!flight) {
        throw new NotFoundException(`Flight with ID ${id} not found`);
      }

      return flight;
    } catch (error) {
      this.logger.error(`Error finding flight with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Search for flights based on search criteria
   * @param searchFlightDto The search parameters
   * @returns Array of matching flights
   */
  async search(searchFlightDto: SearchFlightDto): Promise<Flight[]> {
    try {
      const {
        originCode,
        destinationCode,
        departureDate,
        returnDate,
        cabinClass,
        passengers,
        priceRange,
        airline,
      } = searchFlightDto;

      // Build the base query
      const filters: Prisma.FlightWhereInput[] = [
        {
          origin: { code: originCode },
          destination: { code: destinationCode },
        },
      ];

      // Add date filter if provided
      if (departureDate) {
        const startDate = new Date(departureDate);
        const endDate = new Date(departureDate);
        endDate.setHours(23, 59, 59, 999);

        filters.push({
          departureTime: {
            gte: startDate,
            lte: endDate,
          },
        });
      }

      // Add airline filter if provided
      if (airline) {
        filters.push({ airline });
      }

      // Add price range filter if provided
      if (priceRange?.min !== undefined && priceRange?.max !== undefined) {
        filters.push({
          basePrice: {
            gte: priceRange.min,
            lte: priceRange.max,
          },
        });
      }

      // Execute the query
      const flights = await this.prisma.flight.findMany({
        where: {
          AND: filters,
        },
        include: {
          origin: true,
          destination: true,
        },
        orderBy: {
          departureTime: 'asc',
        },
      });

      // Filter flights that have enough available seats for the requested cabin class
      if (cabinClass && passengers) {
        return this.filterFlightsByAvailability(
          flights,
          cabinClass,
          passengers,
        );
      }

      return flights;
    } catch (error) {
      this.logger.error('Error searching flights:', error);
      throw error;
    }
  }

  /**
   * Filter flights based on seat availability
   * @param flights List of flights to filter
   * @param cabinClass The requested cabin class
   * @param passengers Number of passengers
   * @returns Filtered list of flights with sufficient seats
   */
  private async filterFlightsByAvailability(
    flights: Flight[],
    cabinClass: CabinClass,
    passengers: number,
  ): Promise<Flight[]> {
    // Create a list to store flights with sufficient availability
    const availableFlights: Flight[] = [];

    for (const flight of flights) {
      try {
        // Get the total seats for the requested cabin class
        const totalSeats = (flight.totalSeats as any)[cabinClass] || 0;

        // Count booked seats for this flight and cabin class
        const bookedSeats = await this.prisma.booking.count({
          where: {
            flightId: flight.id,
            selectedCabin: cabinClass,
            status: {
              in: ['Confirmed', 'Pending', 'AwaitingPayment'],
            },
          },
        });

        // Count seats that are currently locked
        const lockedSeats = await this.prisma.seatLock.count({
          where: {
            flightId: flight.id,
            seat: {
              cabin: cabinClass,
            },
            status: 'Active',
            expiresAt: {
              gt: new Date(), // Only count active locks
            },
          },
        });

        // Calculate available seats
        const availableSeats = totalSeats - bookedSeats - lockedSeats;

        // Add flight to result if there are enough seats
        if (availableSeats >= passengers) {
          availableFlights.push(flight);
        }
      } catch (error) {
        this.logger.error(
          `Error checking availability for flight ${flight.id}:`,
          error,
        );
        // Continue with the next flight if there's an error
      }
    }

    return availableFlights;
  }
}
