import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserProfileDto {
  @ApiProperty({
    description: 'The Supabase Auth user ID',
    example: 'auth0|123456789',
  })
  @IsNotEmpty()
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'Full name of the user',
    example: 'John Doe',
  })
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @ApiProperty({
    description: 'Email address of the user',
    example: 'john.doe@example.com',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Phone number of the user',
    example: '+1234567890',
    required: false,
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    description: 'Address of the user',
    example: '123 Main St, Anytown, AT 12345',
    required: false,
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    description: 'Birthdate of the user',
    example: '1990-01-01',
    required: false,
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  birthdate?: Date;

  @ApiProperty({
    description: 'Payment information of the user',
    example: {
      cardTokens: ['tok_visa'],
      billingAddress: '123 Main St, Anytown, AT 12345',
    },
    required: false,
  })
  @IsOptional()
  paymentInfo?: Record<string, any>;

  @ApiProperty({
    description: 'Travel preferences of the user',
    example: {
      seatPreference: 'window',
      mealPreference: 'vegetarian',
      frequentFlyerNumbers: {
        DL: '1234567890',
        AA: '0987654321',
      },
    },
    required: false,
  })
  @IsOptional()
  preferences?: Record<string, any>;
}
