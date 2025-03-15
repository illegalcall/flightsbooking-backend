import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreatePaymentIntentDto {
  @ApiProperty({
    description: 'The ID of the booking to pay for',
    example: 'e87ef3f1-1f2a-4c63-aa12-5e0b34e25ba0',
  })
  @IsUUID()
  @IsNotEmpty()
  bookingId: string;

  @ApiProperty({
    description: 'The currency to use for payment',
    example: 'usd',
  })
  @IsString()
  @IsNotEmpty()
  currency: string;
}
