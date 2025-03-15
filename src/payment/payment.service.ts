import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
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
  }

  /**
   * Creates a payment intent for a booking
   * @param userId User ID from auth context
   * @param createPaymentIntentDto Payment intent creation data
   * @returns Payment intent details
   */
  async createPaymentIntent(
    userId: string,
    createPaymentIntentDto: CreatePaymentIntentDto,
  ): Promise<PaymentResponseDto> {
    const { bookingId, currency } = createPaymentIntentDto;

    try {
      // Find the user profile
      const userProfile = await this.prisma.userProfile.findUnique({
        where: { userId },
      });

      if (!userProfile) {
        throw new NotFoundException(
          `User profile not found for user ${userId}`,
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
      this.logger.error(`Webhook error: ${error.message}`, error.stack);
      throw new BadRequestException(`Webhook error: ${error.message}`);
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
