import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { BookingStatus } from '@prisma/client';
import Stripe from 'stripe';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly stripe: Stripe;
  private readonly defaultCurrency: string;
  private readonly enableAmountVerification: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    // Initialize Stripe with the API key from environment variables
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY'),
      {
        apiVersion: '2023-10-16' as any, // Type assertion for now
      },
    );

    // Get default currency from configuration or fall back to 'usd'
    this.defaultCurrency = this.configService.get<string>(
      'DEFAULT_CURRENCY',
      'usd',
    );

    // Enable amount verification for payment security (default: true)
    this.enableAmountVerification = this.configService.get<boolean>(
      'ENABLE_AMOUNT_VERIFICATION',
      true,
    );
  }

  /**
   * Creates a payment intent for a booking
   * @param userId The ID of the user creating the payment intent
   * @param createPaymentIntentDto The payment intent data
   * @returns The created payment intent response
   */
  async createPaymentIntent(
    userId: string,
    createPaymentIntentDto: CreatePaymentIntentDto,
  ): Promise<PaymentResponseDto> {
    const {
      bookingId,
      currency = this.defaultCurrency,
      expectedAmount,
    } = createPaymentIntentDto;

    try {
      // Validate userId
      if (!userId) {
        throw new BadRequestException(
          'User ID is required to create a payment intent',
        );
      }

      // Find the user profile
      const userProfile = await this.prisma.userProfile.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!userProfile) {
        throw new NotFoundException(
          `User profile not found for user ID: ${userId}`,
        );
      }

      // Retrieve the booking
      const booking = await this.prisma.booking.findFirst({
        where: {
          id: bookingId,
          userProfileId: userProfile.id,
        },
      });

      if (!booking) {
        throw new NotFoundException(
          `Booking with ID ${bookingId} not found or does not belong to you`,
        );
      }

      // Check if the booking is in a state where it can be paid
      if (booking.status !== BookingStatus.Pending) {
        throw new BadRequestException(
          `Booking with ID ${bookingId} is not in a payable state. Current status: ${booking.status}`,
        );
      }

      // Verify that the booking amount matches the expected amount (if provided and enabled)
      if (
        this.enableAmountVerification &&
        expectedAmount !== undefined &&
        booking.totalAmount !== expectedAmount
      ) {
        this.logger.warn(
          `Amount mismatch detected for booking ${bookingId}. Expected: ${expectedAmount}, Actual: ${booking.totalAmount}`,
        );
        throw new BadRequestException(
          `Amount verification failed. The booking amount does not match the expected amount.`,
        );
      }

      // Convert totalAmount to cents for Stripe (Stripe uses smallest currency unit)
      const amountInCents = Math.round(booking.totalAmount * 100);

      // Create a payment intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency: currency.toLowerCase(),
        metadata: {
          bookingId: booking.id,
          userProfileId: userProfile.id,
          bookingReference: booking.bookingReference,
        },
        // Automatically attach a payment method if the customer has one saved
        setup_future_usage: 'off_session',
      });

      // Update the booking status to AwaitingPayment
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.AwaitingPayment,
          paymentInfo: {
            paymentIntentId: paymentIntent.id,
            createdAt: new Date(),
          },
        },
      });

      // Return the payment intent details
      return new PaymentResponseDto({
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: booking.totalAmount,
        currency: currency.toLowerCase(),
        bookingId: booking.id,
        message: 'Payment intent created successfully',
      });
    } catch (error) {
      this.logger.error(
        `Error creating payment intent: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Processes a Stripe webhook event
   * @param signature Stripe signature
   * @param payload Event payload
   * @returns Processing result
   */
  async handleStripeWebhook(
    signature: string,
    payload: Buffer,
  ): Promise<PaymentResponseDto> {
    try {
      const webhookSecret = this.configService.get<string>(
        'STRIPE_WEBHOOK_SECRET',
      );

      // Verify the webhook signature
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );

      // Process the event based on its type
      switch (event.type) {
        case 'payment_intent.succeeded':
          return await this.handlePaymentIntentSucceeded(event.data.object);
        case 'payment_intent.payment_failed':
          return await this.handlePaymentIntentFailed(event.data.object);
        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
          return new PaymentResponseDto({
            success: true,
            message: `Received event: ${event.type}`,
          });
      }
    } catch (error) {
      // Enhanced error handling with detailed logging
      const errorId = this.generateErrorId();
      const errorDetails = {
        errorId,
        message: error.message,
        stack: error.stack,
        type: error.constructor.name,
        timestamp: new Date().toISOString(),
        additionalInfo: {
          signatureLength: signature ? signature.length : 0,
          payloadLength: payload ? payload.length : 0,
        },
      };

      // Log detailed error information for debugging
      this.logger.error(
        `Webhook error [${errorId}]: ${error.message}`,
        JSON.stringify(errorDetails),
      );

      // Send to monitoring service if configured
      this.sendToMonitoringService(errorDetails);

      // Throw a BadRequestException with error reference ID for client
      throw new BadRequestException(
        `Webhook processing error. Reference ID: ${errorId}`,
      );
    }
  }

  /**
   * Generates a unique error ID for tracking
   * @returns Random error identifier string
   */
  private generateErrorId(): string {
    return 'err_' + Math.random().toString(36).substring(2, 12);
  }

  /**
   * Sends error details to a monitoring service (e.g., Sentry, DataDog)
   * @param errorDetails Error information to send
   */
  private sendToMonitoringService(errorDetails: any): void {
    // This is a placeholder for actual integration with a monitoring service
    // In a production environment, you would integrate with your chosen service
    const monitoringEnabled = this.configService.get<boolean>(
      'ENABLE_ERROR_MONITORING',
      false,
    );

    if (monitoringEnabled) {
      try {
        // Example with a hypothetical monitoring client
        // monitoringClient.captureException(errorDetails);
        this.logger.debug(
          `Error details sent to monitoring service: ${errorDetails.errorId}`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to send error to monitoring service: ${err.message}`,
        );
      }
    }
  }

  /**
   * Handles a successful payment intent
   * @param paymentIntent Stripe payment intent object
   * @returns Processing result
   */
  private async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<PaymentResponseDto> {
    try {
      const { bookingId } = paymentIntent.metadata;

      if (!bookingId) {
        throw new BadRequestException(
          'No booking ID found in payment intent metadata',
        );
      }

      // Find the booking
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
      });

      if (!booking) {
        throw new NotFoundException(`Booking with ID ${bookingId} not found`);
      }

      // Update the booking status to Confirmed
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.Confirmed,
          confirmedAt: new Date(),
          paymentInfo: {
            ...((booking.paymentInfo as object) || {}),
            status: 'succeeded',
            updatedAt: new Date(),
          },
        },
      });

      return new PaymentResponseDto({
        success: true,
        paymentIntentId: paymentIntent.id,
        bookingId,
        message: 'Payment successful, booking confirmed',
      });
    } catch (error) {
      this.logger.error(
        `Error handling successful payment: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Handles a failed payment intent
   * @param paymentIntent Stripe payment intent object
   * @returns Processing result
   */
  private async handlePaymentIntentFailed(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<PaymentResponseDto> {
    try {
      const { bookingId } = paymentIntent.metadata;

      if (!bookingId) {
        throw new BadRequestException(
          'No booking ID found in payment intent metadata',
        );
      }

      // Find the booking
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
      });

      if (!booking) {
        throw new NotFoundException(`Booking with ID ${bookingId} not found`);
      }

      // Update the booking with the failed payment info but keep the status as AwaitingPayment
      // to allow retrying the payment
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          paymentInfo: {
            ...((booking.paymentInfo as object) || {}),
            status: 'failed',
            updatedAt: new Date(),
          },
        },
      });

      return new PaymentResponseDto({
        success: false,
        paymentIntentId: paymentIntent.id,
        bookingId,
        message: 'Payment failed: ' + paymentIntent.last_payment_error?.message,
      });
    } catch (error) {
      this.logger.error(
        `Error handling failed payment: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
