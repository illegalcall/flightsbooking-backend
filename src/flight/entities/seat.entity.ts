import { ApiProperty } from '@nestjs/swagger';
import { CabinClass } from '@prisma/client';

export class Seat {
  @ApiProperty({ description: 'Unique identifier of the seat' })
  id: string;

  @ApiProperty({ description: 'Flight ID this seat belongs to' })
  flightId: string;

  @ApiProperty({ description: 'Seat number (e.g., 12A, 23C)' })
  seatNumber: string;

  @ApiProperty({
    description: 'Cabin class',
    enum: CabinClass,
    example: CabinClass.Economy,
  })
  cabin: CabinClass;

  @ApiProperty({
    description: 'Position information (row and column)',
    example: { row: 12, col: 'A' },
  })
  position: any;

  @ApiProperty({
    description: 'Whether the seat is blocked for operational reasons',
    example: false,
  })
  isBlocked: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ApiProperty({
    description: 'Whether the seat is booked',
    example: false,
  })
  isBooked?: boolean;

  @ApiProperty({
    description: 'Whether the seat is temporarily locked',
    example: false,
  })
  isLocked?: boolean;
}
