import { ApiProperty } from '@nestjs/swagger';
import { Booking, BookingStatus, CabinClass } from '@prisma/client';

export class BookingResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the booking',
    example: 'e87ef3f1-1f2a-4c63-aa12-5e0b34e25ba0',
  })
  id: string;

  @ApiProperty({
    description: 'Booking reference code',
    example: 'ABC123XYZ',
  })
  bookingReference: string;

  @ApiProperty({
    description: 'Current status of the booking',
    enum: BookingStatus,
    example: BookingStatus.Pending,
  })
  status: BookingStatus;

  @ApiProperty({
    description: 'ID of the user who created the booking',
    example: 'e87ef3f1-1f2a-4c63-aa12-5e0b34e25ba0',
  })
  userProfileId: string;

  @ApiProperty({
    description: 'ID of the flight being booked',
    example: 'e87ef3f1-1f2a-4c63-aa12-5e0b34e25ba0',
  })
  flightId: string;

  @ApiProperty({
    description: 'Selected cabin class for the booking',
    enum: CabinClass,
    example: CabinClass.Economy,
  })
  selectedCabin: CabinClass;

  @ApiProperty({
    description: 'Total amount to be paid',
    example: 450.75,
  })
  totalAmount: number;

  @ApiProperty({
    description: 'Passenger details associated with the booking',
    example: [
      {
        fullName: 'John Doe',
        age: 35,
        documentNumber: 'AB123456',
      },
    ],
  })
  passengerDetails: any;

  @ApiProperty({
    description: 'Array of booked seat numbers',
    example: ['12A', '12B'],
  })
  bookedSeats: string[];

  @ApiProperty({
    description: 'Date and time when booking was created',
    example: '2023-03-14T12:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Date and time when booking was last updated',
    example: '2023-03-14T12:05:00Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Date and time when booking was confirmed, if applicable',
    example: '2023-03-14T12:10:00Z',
    required: false,
  })
  confirmedAt?: Date;

  constructor(partial: Partial<BookingResponseDto>) {
    Object.assign(this, partial);
  }

  static fromEntity(
    booking: Booking,
    bookedSeats: string[] = [],
  ): BookingResponseDto {
    return new BookingResponseDto({
      id: booking.id,
      bookingReference: booking.bookingReference,
      status: booking.status,
      userProfileId: booking.userProfileId,
      flightId: booking.flightId,
      selectedCabin: booking.selectedCabin,
      totalAmount: booking.totalAmount,
      passengerDetails: booking.passengerDetails,
      bookedSeats,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      confirmedAt: booking.confirmedAt,
    });
  }
}
