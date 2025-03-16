import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUUID,
  ValidateNested,
  IsOptional,
} from 'class-validator';
import { CabinClass } from '@prisma/client';

export class PassengerDetailsDto {
  @ApiProperty({
    description: 'Full name of the passenger',
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({
    description: 'Age of the passenger',
    example: 30,
  })
  @IsNotEmpty()
  age: number;

  @ApiProperty({
    description: 'Passport number or ID of the passenger',
    example: 'AB123456',
  })
  @IsString()
  @IsNotEmpty()
  documentNumber: string;

  @ApiProperty({
    description: 'Special requests or needs for the passenger',
    example: 'Vegetarian meal',
    required: false,
  })
  @IsString()
  @IsOptional()
  specialRequests?: string;
}

export class CreateBookingDto {
  @ApiProperty({
    description: 'ID of the flight to book',
    example: 'e87ef3f1-1f2a-4c63-aa12-5e0b34e25ba0',
  })
  @IsUUID()
  @IsNotEmpty()
  flightId: string;

  @ApiProperty({
    description: 'Cabin class for the booking',
    enum: CabinClass,
    example: CabinClass.Economy,
  })
  @IsEnum(CabinClass)
  @IsNotEmpty()
  selectedCabin: CabinClass;

  @ApiProperty({
    description: 'Array of passenger details',
    type: [PassengerDetailsDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PassengerDetailsDto)
  @IsNotEmpty()
  passengerDetails: PassengerDetailsDto[];

  @ApiProperty({
    description: 'Array of seat numbers to book',
    example: ['12A', '12B'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  seatNumbers: string[];
}
