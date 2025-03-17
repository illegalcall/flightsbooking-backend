import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { BookingStatus, CabinClass } from '@prisma/client';
import { AdminPaginationDto } from './admin-pagination.dto';
import { AdminResponseDto } from './admin-response.dto';

export class BookingFilterDto extends AdminPaginationDto {
  @ApiProperty({
    description: 'Filter bookings by status',
    enum: BookingStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiProperty({
    description: 'Filter bookings by cabin class',
    enum: CabinClass,
    required: false,
  })
  @IsOptional()
  @IsEnum(CabinClass)
  cabinClass?: CabinClass;

  @ApiProperty({
    description: 'Search by booking reference or passenger name',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Filter bookings from date',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiProperty({
    description: 'Filter bookings to date',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class BookingListResponseDto extends AdminResponseDto {
  @ApiProperty({
    description: 'List of bookings',
    type: 'array',
  })
  data: {
    id: string;
    bookingReference: string;
    userProfile: {
      id: string;
      fullName: string;
      email: string;
    };
    flight: {
      id: string;
      flightNumber: string;
      departureTime: Date;
      arrivalTime: Date;
      origin: {
        code: string;
        city: string;
      };
      destination: {
        code: string;
        city: string;
      };
    };
    passengerDetails: any;
    selectedCabin: CabinClass;
    status: BookingStatus;
    totalAmount: number;
    createdAt: Date;
    updatedAt: Date;
  }[];

  @ApiProperty({
    description: 'Total number of bookings matching the filter',
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

export class UpdateBookingStatusDto {
  @ApiProperty({
    description: 'New status for the booking',
    enum: BookingStatus,
  })
  @IsEnum(BookingStatus)
  status: BookingStatus;

  @ApiProperty({
    description: 'Reason for status change',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
