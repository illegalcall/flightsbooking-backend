import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsDateString,
  IsEnum,
  IsJSON,
  IsOptional,
} from 'class-validator';
import { FlightStatus } from '@prisma/client';
import { AdminPaginationDto } from './admin-pagination.dto';
import { AdminResponseDto } from './admin-response.dto';

export class CreateFlightDto {
  @ApiProperty({ description: 'Flight number', example: 'FL123' })
  @IsString()
  flightNumber: string;

  @ApiProperty({ description: 'Airline name', example: 'Test Airlines' })
  @IsString()
  airline: string;

  @ApiProperty({ description: 'Aircraft type', example: 'Boeing 737' })
  @IsString()
  aircraftType: string;

  @ApiProperty({
    description: 'Departure time',
    example: '2024-03-25T10:00:00Z',
  })
  @IsDateString()
  departureTime: string;

  @ApiProperty({ description: 'Arrival time', example: '2024-03-25T12:00:00Z' })
  @IsDateString()
  arrivalTime: string;

  @ApiProperty({ description: 'Flight duration in minutes', example: 120 })
  @IsNumber()
  duration: number;

  @ApiProperty({ description: 'Origin airport ID' })
  @IsString()
  originId: string;

  @ApiProperty({ description: 'Destination airport ID' })
  @IsString()
  destinationId: string;

  @ApiProperty({
    description: 'Base price in the lowest cabin class',
    example: 100,
  })
  @IsNumber()
  basePrice: number;

  @ApiProperty({
    description: 'Total seats configuration by cabin class',
    example: {
      Economy: { seats: 150, multiplier: 1.0 },
      PremiumEconomy: { seats: 50, multiplier: 1.5 },
      Business: { seats: 30, multiplier: 2.5 },
      First: { seats: 10, multiplier: 4.0 },
    },
  })
  @IsJSON()
  totalSeats: string;
}

export class UpdateFlightDto extends CreateFlightDto {
  @ApiProperty({
    description: 'Flight status',
    enum: FlightStatus,
    required: false,
  })
  @IsEnum(FlightStatus)
  @IsOptional()
  status?: FlightStatus;
}

export class FlightFilterDto extends AdminPaginationDto {
  @ApiProperty({
    description: 'Filter by airline',
    required: false,
  })
  @IsOptional()
  @IsString()
  airline?: string;

  @ApiProperty({
    description: 'Filter by flight number',
    required: false,
  })
  @IsOptional()
  @IsString()
  flightNumber?: string;

  @ApiProperty({
    description: 'Filter by origin airport code',
    required: false,
  })
  @IsOptional()
  @IsString()
  originCode?: string;

  @ApiProperty({
    description: 'Filter by destination airport code',
    required: false,
  })
  @IsOptional()
  @IsString()
  destinationCode?: string;

  @ApiProperty({
    description: 'Filter by flight status',
    enum: FlightStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(FlightStatus)
  status?: FlightStatus;

  @ApiProperty({
    description: 'Filter flights from date',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiProperty({
    description: 'Filter flights to date',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class FlightListResponseDto extends AdminResponseDto {
  @ApiProperty({
    description: 'List of flights',
    type: 'array',
  })
  data: {
    id: string;
    flightNumber: string;
    airline: string;
    aircraftType: string;
    departureTime: Date;
    arrivalTime: Date;
    duration: number;
    origin: {
      code: string;
      city: string;
    };
    destination: {
      code: string;
      city: string;
    };
    basePrice: number;
    totalSeats: any;
    status: FlightStatus;
    createdAt: Date;
    updatedAt: Date;
  }[];

  @ApiProperty({
    description: 'Total number of flights matching the filter',
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
  })
  limit: number;
}
