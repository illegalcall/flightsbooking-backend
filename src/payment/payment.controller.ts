import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Headers,
  RawBodyRequest,
  Req,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { CreatePaymentIntentDto, PaymentResponseDto } from './dto';

@ApiTags('payments')
@Controller({
  path: 'payments',
  version: '1',
})
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @Post('create-intent')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a payment intent for a booking' })
  @ApiResponse({
    status: 201,
    description: 'Payment intent created successfully',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBody({ type: CreatePaymentIntentDto })
  async createPaymentIntent(
    @Request() req,
    @Body() createPaymentIntentDto: CreatePaymentIntentDto,
  ): Promise<PaymentResponseDto> {
    try {
      // Extract the user ID from the request (set by the AuthGuard)
      const userId = req.user.sub;
      return await this.paymentService.createPaymentIntent(
        userId,
        createPaymentIntentDto,
      );
    } catch (error) {
      this.logger.error(
        `Error in createPaymentIntent: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Handle Stripe webhook events' })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() request: RawBodyRequest<Request>,
  ): Promise<PaymentResponseDto> {
    try {
      const payload = request.rawBody;
      if (!payload) {
        throw new Error('No raw body provided');
      }
      if (!signature) {
        throw new Error('No Stripe signature provided');
      }
      return await this.paymentService.handleStripeWebhook(signature, payload);
    } catch (error) {
      this.logger.error(
        `Error in handleWebhook: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
