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
  BadRequestException,
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
      const userId = req.user?.userId;

      if (!userId) {
        this.logger.error('User ID is missing from the authentication token');
        throw new BadRequestException(
          'Invalid authentication token: user ID missing',
        );
      }

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
  @ApiOperation({
    summary: 'Handle Stripe webhook events',
    description:
      'Processes Stripe webhook events. This endpoint must be configured to receive raw body data for signature verification.',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() request: any,
  ): Promise<PaymentResponseDto> {
    try {
      // Log webhook event received with detailed information
      this.logger.log('Webhook received', {
        path: request.url,
        method: request.method,
        hasSignature: !!signature,
        signatureLength: signature ? signature.length : 0,
        contentType: request.headers['content-type'],
        bodyType: typeof request.body,
        isBuffer: Buffer.isBuffer(request.body),
        bodyLength: request.body
          ? Buffer.isBuffer(request.body)
            ? request.body.length
            : JSON.stringify(request.body).length
          : 0,
      });

      // Ensure the request body is a Buffer
      if (!request.body) {
        throw new BadRequestException('Missing request body');
      }

      // If body is not already a buffer, and it's an object, try to stringify and convert to buffer
      let rawBody: Buffer;
      if (!Buffer.isBuffer(request.body)) {
        this.logger.warn('Request body is not a buffer, attempting to convert');
        if (typeof request.body === 'string') {
          rawBody = Buffer.from(request.body);
        } else if (typeof request.body === 'object') {
          rawBody = Buffer.from(JSON.stringify(request.body));
        } else {
          throw new BadRequestException(
            'Invalid webhook payload format. Cannot convert to buffer.',
          );
        }
      } else {
        rawBody = request.body;
      }

      if (!signature) {
        throw new BadRequestException('No Stripe signature provided');
      }

      this.logger.log('Processing webhook with valid payload', {
        payloadLength: rawBody.length,
        signatureLength: signature.length,
        url: request.originalUrl,
      });

      // Pass the raw buffer directly to the service
      return await this.paymentService.handleStripeWebhook(signature, rawBody);
    } catch (error) {
      this.logger.error(
        `Error in handleWebhook: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
