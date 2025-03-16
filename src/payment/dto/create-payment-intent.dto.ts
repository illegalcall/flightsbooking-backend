import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsNumber,
  IsOptional,
} from 'class-validator';

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

  @ApiPropertyOptional({
    description: 'Expected total amount to be paid (for fraud prevention)',
    example: 199.99,
  })
  @IsNumber()
  @IsOptional()
  expectedAmount?: number;
}
