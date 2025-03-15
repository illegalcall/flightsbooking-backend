import { ApiProperty } from '@nestjs/swagger';
import { CabinClass } from '@prisma/client';

export class CabinClassConfig {
  @ApiProperty({
    description: 'Cabin class type',
    enum: CabinClass,
    example: CabinClass.Economy,
  })
  cabin: CabinClass;

  @ApiProperty({
    description: 'Price multiplier for this cabin class',
    example: 1.0,
  })
  multiplier: number;

  @ApiProperty({
    description: 'Number of seats available in this cabin class',
    example: 160,
  })
  seats: number;
}

export type CabinClassMultipliers = Record<CabinClass, number>;

export interface CabinSeatInfo {
  seats: number;
  multiplier: number;
}

export type CabinClassSeats = Record<CabinClass, CabinSeatInfo>;
