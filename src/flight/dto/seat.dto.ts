import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { CabinClass } from '@prisma/client';
import { Type } from 'class-transformer';

export class GetSeatsDto {
  @ApiProperty({
    description: 'ID of the flight to get seats for',
    example: 'e87ef3f1-1f2a-4c63-aa12-5e0b34e25ba0',
  })
  @IsUUID()
  @IsNotEmpty()
  flightId: string;

  @ApiProperty({
    description: 'Filter seats by cabin class',
    enum: CabinClass,
    required: false,
  })
  @IsEnum(CabinClass)
  @IsOptional()
  cabinClass?: CabinClass;
}

export class SeatMapDto {
  @ApiProperty({
    description: 'The cabin class',
    enum: CabinClass,
  })
  cabin: CabinClass;

  @ApiProperty({
    description: 'The total number of rows in this cabin',
    example: 10,
  })
  rows: number;

  @ApiProperty({
    description: 'The columns/letters available in this cabin',
    example: ['A', 'B', 'C', 'D', 'E', 'F'],
  })
  columns: string[];

  @ApiProperty({
    description: 'The list of seats in this cabin',
    type: [Object],
  })
  seats: any[];
}

export class SeatMapResponseDto {
  @ApiProperty({
    description: 'The flight ID',
    example: 'e87ef3f1-1f2a-4c63-aa12-5e0b34e25ba0',
  })
  flightId: string;

  @ApiProperty({
    description: 'Seat maps organized by cabin class',
    type: [SeatMapDto],
  })
  seatMaps: SeatMapDto[];
}
