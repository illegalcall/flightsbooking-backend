import { ApiProperty } from '@nestjs/swagger';

export class PaymentResponseDto {
  @ApiProperty({
    description: 'Whether the payment operation was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Client secret for Stripe.js',
    example: 'pi_3LnKlUGswQdkPHmV0iqQQQQQ_secret_cTPaaHlDcpvRccZY74oDEsUPD',
    required: false,
  })
  clientSecret?: string;

  @ApiProperty({
    description: 'Payment intent ID',
    example: 'pi_3LnKlUGswQdkPHmV0iqQQQQQ',
    required: false,
  })
  paymentIntentId?: string;

  @ApiProperty({
    description: 'Amount to be charged',
    example: 450.75,
    required: false,
  })
  amount?: number;

  @ApiProperty({
    description: 'Currency of the transaction',
    example: 'usd',
    required: false,
  })
  currency?: string;

  @ApiProperty({
    description: 'ID of the booking associated with this payment',
    example: 'e87ef3f1-1f2a-4c63-aa12-5e0b34e25ba0',
    required: false,
  })
  bookingId?: string;

  @ApiProperty({
    description: 'Message with additional information',
    example: 'Payment intent created successfully',
    required: false,
  })
  message?: string;

  constructor(partial: Partial<PaymentResponseDto>) {
    Object.assign(this, partial);
  }
}
