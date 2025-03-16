import { ApiProperty } from '@nestjs/swagger';
import {
  Flight as PrismaFlight,
  CabinClass,
  FlightStatus,
  Prisma,
} from '@prisma/client';
import {
  CabinClassSeats,
  CabinSeatInfo,
} from '../../booking/dto/cabin-class-config.dto';

export class Flight implements Omit<PrismaFlight, 'totalSeats'> {
  @ApiProperty({ description: 'Unique identifier of the flight' })
  id: string;

  @ApiProperty({ description: 'Flight number' })
  flightNumber: string;

  @ApiProperty({ description: 'Airline operating the flight' })
  airline: string;

  @ApiProperty({ description: 'Type of aircraft' })
  aircraftType: string;

  @ApiProperty({ description: 'Departure time' })
  departureTime: Date;

  @ApiProperty({ description: 'Arrival time' })
  arrivalTime: Date;

  @ApiProperty({ description: 'Flight duration in minutes' })
  duration: number;

  @ApiProperty({ description: 'Origin airport ID' })
  originId: string;

  @ApiProperty({ description: 'Destination airport ID' })
  destinationId: string;

  @ApiProperty({ description: 'Base price in the lowest cabin class' })
  basePrice: number;

  @ApiProperty({
    description: 'Total seats by cabin class with price multipliers',
    example: {
      Economy: { seats: 150, multiplier: 1.0 },
      PremiumEconomy: { seats: 50, multiplier: 1.5 },
      Business: { seats: 30, multiplier: 2.5 },
      First: { seats: 10, multiplier: 4.0 },
    },
  })
  totalSeats: Prisma.JsonValue;

  @ApiProperty({
    description: 'Current flight status',
    enum: FlightStatus,
    example: FlightStatus.Scheduled,
  })
  status: FlightStatus;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ApiProperty({
    description: 'Origin airport details',
    type: 'object',
    required: true,
  })
  origin?: any;

  @ApiProperty({
    description: 'Destination airport details',
    type: 'object',
    required: true,
  })
  destination?: any;

  @ApiProperty({
    description: 'Dynamically calculated price based on availability',
    required: false,
  })
  calculatedPrice?: number;

  /**
   * Cabin class seats with price multipliers
   */
  cabinSeatsWithMultipliers?: CabinClassSeats;
}
