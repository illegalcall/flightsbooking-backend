import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsDateString,
  Min,
  ValidateNested,
  IsNotEmpty,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CabinClass, Flight } from '@prisma/client';

/**
 * Price range for flight search
 */
export class PriceRangeDto {
  @ApiProperty({ description: 'Minimum price', example: 100 })
  @IsInt()
  @Min(0)
  min: number;

  @ApiProperty({ description: 'Maximum price', example: 1000 })
  @IsInt()
  @Min(0)
  max: number;
}

/**
 * Data transfer object for flight search parameters
 */
export class SearchFlightDto {
  @ApiProperty({ description: 'Origin airport code', example: 'JFK' })
  @IsString()
  @IsNotEmpty()
  originCode: string;

  @ApiProperty({ description: 'Destination airport code', example: 'LAX' })
  @IsString()
  @IsNotEmpty()
  destinationCode: string;

  @ApiProperty({
    description: 'Departure date (YYYY-MM-DD)',
    example: '2023-12-25',
  })
  @IsDateString()
  departureDate: string;

  @ApiPropertyOptional({
    description: 'Return date (YYYY-MM-DD) for round trip',
    example: '2023-12-30',
  })
  @IsOptional()
  @IsDateString()
  returnDate?: string;

  @ApiPropertyOptional({
    description: 'Cabin class preference',
    enum: CabinClass,
    example: CabinClass.Economy,
  })
  @IsOptional()
  @IsEnum(CabinClass)
  cabinClass?: CabinClass;

  @ApiPropertyOptional({ description: 'Number of passengers', example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  passengers?: number;

  @ApiPropertyOptional({
    description: 'Price range for filtering flights',
    type: PriceRangeDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PriceRangeDto)
  priceRange?: PriceRangeDto;

  @ApiPropertyOptional({
    description: 'Airline filter',
    example: 'Delta Airlines',
  })
  @IsOptional()
  @IsString()
  airline?: string;

  @ApiPropertyOptional({
    description: 'Cursor for pagination (flight ID)',
    example: 'abc123',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Number of results per page (default: 10, max: 50)',
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

/**
 * Response DTO for paginated flight search results
 */
export class PaginatedFlightResponseDto {
  @ApiProperty({ description: 'List of flights matching search criteria' })
  data: Flight[];

  @ApiProperty({
    description: 'Total number of flights matching search criteria',
  })
  total: number;

  @ApiPropertyOptional({
    description: 'Cursor for the next page of results',
    example: 'abc123',
  })
  nextCursor?: string;

  @ApiPropertyOptional({
    description: 'Whether there are more results available',
  })
  hasMore: boolean;
}
