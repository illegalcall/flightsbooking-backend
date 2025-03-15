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
import { BookingService } from '../booking/booking.service';
import { CabinClassSeats } from '../booking/dto/cabin-class-config.dto';

@Injectable()
export class FlightService {
  private readonly logger = new Logger(FlightService.name);
  private readonly CACHE_TTL = flightPricingConfig.cacheTTL;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly bookingService: BookingService,
  ) {}

  /**
   * Transforms the flight's totalSeats to include multipliers
   * @param flight The flight entity to transform
   * @returns The flight with enhanced totalSeats property
   */
  private async enhanceFlightWithMultipliers(flight: Flight): Promise<Flight> {
    try {
      // Get cabin seats with multipliers
      const cabinSeatsWithMultipliers =
        await this.bookingService.getCabinSeatsWithMultipliers(flight.id);

      // Add the property to the flight object
      flight.cabinSeatsWithMultipliers = cabinSeatsWithMultipliers;

      return flight;
    } catch (error) {
      this.logger.error(
        `Error enhancing flight with multipliers: ${error.message}`,
        error.stack,
      );
      return flight; // Return the original flight if enhancement fails
    }
  }

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

      // Enhance flight with cabin class multipliers
      return await this.enhanceFlightWithMultipliers(flight as Flight);
    } catch (error) {
      this.logger.error(`Error finding flight with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Search for flights based on search criteria with pagination
   * @param searchFlightDto Search criteria and pagination options
   * @returns Flights matching the search criteria
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
        passengers,
        cabinClass,
        page = 1,
        limit = 10,
      } = searchFlightDto;

      // Generate a cache key
      const cacheKey = this.generateCacheKey(searchFlightDto);

      // Try to get from cache first
      const cachedResult =
        await this.cacheManager.get<PaginatedFlightResponseDto>(cacheKey);
      if (cachedResult) {
        this.logger.log('Returning flights from cache');
        return cachedResult;
      }

      // Prepare filter conditions
      const departureStartDate = new Date(departureDate);
      departureStartDate.setHours(0, 0, 0, 0);

      const departureEndDate = new Date(departureDate);
      departureEndDate.setHours(23, 59, 59, 999);

      // Build query conditions for outbound flight
      const outboundConditions: Prisma.FlightWhereInput = {
        departureTime: {
          gte: departureStartDate,
          lte: departureEndDate,
        },
        origin: {
          code: originCode,
        },
        destination: {
          code: destinationCode,
        },
        status: 'Scheduled',
      };

      // Calculate offset for pagination
      const skip = (page - 1) * limit;

      // Execute the query
      const [totalCount, flights] = await Promise.all([
        this.prisma.flight.count({
          where: outboundConditions,
        }),
        this.prisma.flight.findMany({
          where: outboundConditions,
          include: {
            origin: true,
            destination: true,
          },
          skip,
          take: limit,
        }),
      ]);

      // Convert the results
      let outboundFlights = flights as Flight[];

      // Filter by availability if cabin class and passengers are specified
      if (cabinClass && passengers) {
        outboundFlights = await this.filterFlightsByAvailability(
          outboundFlights,
          cabinClass,
          passengers,
        );
      }

      // Calculate dynamic prices for each flight
      const flightsWithPrices = await Promise.all(
        outboundFlights.map(async (flight) => {
          // Calculate dynamic price
          const calculatedPrice = await this.calculateDynamicPrice(
            flight,
            cabinClass,
          );

          // Add multipliers to the flight
          const enhancedFlight = await this.enhanceFlightWithMultipliers(
            flight,
          );

          // Add calculated price to the flight object
          enhancedFlight.calculatedPrice = calculatedPrice;

          return enhancedFlight;
        }),
      );

      // Prepare the response
      const result: PaginatedFlightResponseDto = {
        totalCount,
        page,
        pageSize: limit,
        pageCount: Math.ceil(totalCount / limit),
        data: flightsWithPrices,
      };

      // Cache the result
      await this.cacheManager.set(cacheKey, result, this.CACHE_TTL);

      return result;
    } catch (error) {
      this.logger.error(`Error searching flights:`, error);
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
