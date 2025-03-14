import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { CabinClass, Prisma } from '@prisma/client';
import {
  SearchFlightDto,
  PaginatedFlightResponseDto,
} from './dto/search-flight.dto';
import { Flight } from './entities/flight.entity';
import { flightPricingConfig } from '../config/flight.config';

@Injectable()
export class FlightService {
  private readonly logger = new Logger(FlightService.name);
  private readonly CACHE_TTL = flightPricingConfig.cacheTTL;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

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

      return flight as Flight;
    } catch (error) {
      this.logger.error(`Error finding flight with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Search for flights based on search criteria with pagination
   * @param searchFlightDto The search parameters
   * @returns Paginated array of matching flights
   */
  async search(
    searchFlightDto: SearchFlightDto,
  ): Promise<PaginatedFlightResponseDto> {
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
        cursor,
        limit = 10,
      } = searchFlightDto;

      // Try to get results from cache
      const cacheKey = this.generateCacheKey(searchFlightDto);
      const cachedResult =
        await this.cacheManager.get<PaginatedFlightResponseDto>(cacheKey);

      if (cachedResult) {
        this.logger.log('Returning cached flight search results');
        return cachedResult;
      }

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

      // Add cursor-based pagination
      if (cursor) {
        const cursorFlight = await this.prisma.flight.findUnique({
          where: { id: cursor },
          select: { departureTime: true },
        });

        if (cursorFlight) {
          filters.push({
            OR: [
              {
                departureTime: {
                  gt: cursorFlight.departureTime,
                },
              },
              {
                AND: [
                  { departureTime: cursorFlight.departureTime },
                  { id: { gt: cursor } },
                ],
              },
            ],
          });
        }
      }

      // Get total count for pagination
      const totalCount = await this.prisma.flight.count({
        where: {
          AND: filters,
        },
      });

      // Execute the main query
      const flights = await this.prisma.flight.findMany({
        where: {
          AND: filters,
        },
        include: {
          origin: true,
          destination: true,
        },
        orderBy: [{ departureTime: 'asc' }, { id: 'asc' }],
        take: limit + 1, // Take one extra to determine if there are more results
      });

      // Determine if there are more results and get the next cursor
      const hasMore = flights.length > limit;
      const data = flights.slice(0, limit);
      const nextCursor = hasMore ? flights[limit - 1].id : undefined;

      // Filter flights that have enough available seats and calculate dynamic pricing
      let availableFlights = data as Flight[];
      if (cabinClass && passengers) {
        availableFlights = await this.filterFlightsByAvailability(
          data as Flight[],
          cabinClass,
          passengers,
        );
      }

      // Calculate dynamic prices based on availability
      const flightsWithDynamicPricing = await Promise.all(
        availableFlights.map(async (flight) => {
          const dynamicPrice = await this.calculateDynamicPrice(
            flight,
            cabinClass,
          );
          return {
            ...flight,
            calculatedPrice: dynamicPrice,
          };
        }),
      );

      const result: PaginatedFlightResponseDto = {
        data: flightsWithDynamicPricing,
        total: totalCount,
        hasMore,
        nextCursor,
      };

      // Cache the results
      await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);

      return result;
    } catch (error) {
      this.logger.error('Error searching flights:', error);
      throw error;
    }
  }

  /**
   * Generate a cache key for flight search results
   * @param searchParams Search parameters
   * @returns Cache key string
   */
  private generateCacheKey(searchParams: SearchFlightDto): string {
    return `flight_search:${JSON.stringify(searchParams)}`;
  }

  /**
   * Calculate dynamic price based on availability
   * @param flight Flight to calculate price for
   * @param cabinClass Requested cabin class
   * @returns Calculated price
   */
  private async calculateDynamicPrice(
    flight: Flight,
    cabinClass?: CabinClass,
  ): Promise<number> {
    if (!cabinClass) {
      return flight.basePrice;
    }

    try {
      // Get the total seats for the requested cabin class
      const totalSeats = (flight.totalSeats as any)[cabinClass] || 0;

      // Count booked seats
      const bookedSeats = await this.prisma.booking.count({
        where: {
          flightId: flight.id,
          selectedCabin: cabinClass,
          status: {
            in: ['Confirmed', 'Pending', 'AwaitingPayment'],
          },
        },
      });

      // Calculate occupancy rate
      const occupancyRate = bookedSeats / totalSeats;

      // Get base price multiplier from configuration
      const { basePriceMultiplier, occupancyMultipliers } = flightPricingConfig;

      // Determine dynamic multiplier based on occupancy
      let dynamicMultiplier = 1;
      for (const { threshold, multiplier } of occupancyMultipliers) {
        if (occupancyRate > threshold) {
          dynamicMultiplier = multiplier;
          break;
        }
      }

      return Math.round(
        flight.basePrice * basePriceMultiplier[cabinClass] * dynamicMultiplier,
      );
    } catch (error) {
      this.logger.error(
        `Error calculating dynamic price for flight ${flight.id}:`,
        error,
      );
      // Return base price if calculation fails
      return flight.basePrice;
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
