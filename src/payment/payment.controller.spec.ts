import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { CreatePaymentIntentDto } from './dto';
import { Logger, BadRequestException } from '@nestjs/common';

describe('PaymentController', () => {
  let controller: PaymentController;
  let paymentService: PaymentService;

  const mockPaymentService = {
    createPaymentIntent: jest.fn(),
    handleStripeWebhook: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        {
          provide: PaymentService,
          useValue: mockPaymentService,
        },
      ],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
    paymentService = module.get<PaymentService>(PaymentService);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(jest.fn());
    jest.spyOn(Logger.prototype, 'log').mockImplementation(jest.fn());
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPaymentIntent', () => {
    it('should call the payment service with user ID and DTO', async () => {
      const userId = 'user123';
      const createDto: CreatePaymentIntentDto = {
        bookingId: 'booking123',
        currency: 'usd',
        expectedAmount: 100,
      };
      const expectedResult = { clientSecret: 'test_secret' };

      mockPaymentService.createPaymentIntent.mockResolvedValue(expectedResult);

      const result = await controller.createPaymentIntent(
        { user: { userId: userId } },
        createDto,
      );

      expect(paymentService.createPaymentIntent).toHaveBeenCalledWith(
        userId,
        createDto,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should throw BadRequestException if userId is missing', async () => {
      const createDto: CreatePaymentIntentDto = {
        bookingId: 'booking123',
        currency: 'usd',
        expectedAmount: 100,
      };

      await expect(
        controller.createPaymentIntent(
          { user: {} }, // Missing userId
          createDto,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(Logger.prototype.error).toHaveBeenCalled();
    });

    it('should handle service errors properly', async () => {
      const error = new Error('Test error');
      mockPaymentService.createPaymentIntent.mockRejectedValue(error);

      await expect(
        controller.createPaymentIntent(
          { user: { userId: 'user123' } },
          {} as CreatePaymentIntentDto,
        ),
      ).rejects.toThrow(error);

      expect(Logger.prototype.error).toHaveBeenCalled();
    });
  });

  describe('handleWebhook', () => {
    it('should call the payment service with signature and payload', async () => {
      const signature = 'test_signature';
      const body = Buffer.from('test_payload');
      const expectedResult = { success: true };

      mockPaymentService.handleStripeWebhook.mockResolvedValue(expectedResult);

      const result = await controller.handleWebhook(signature, {
        body,
        headers: {
          'content-type': 'application/json',
        },
        url: '/test-url',
        method: 'POST',
        originalUrl: '/v1/payments/webhook',
      });

      expect(paymentService.handleStripeWebhook).toHaveBeenCalledWith(
        signature,
        body,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should convert non-buffer body to buffer and process it', async () => {
      // Mock the service to return a resolved value in case validation passes
      mockPaymentService.handleStripeWebhook.mockResolvedValue({
        success: true,
      });

      // Setup our controller spy to verify it attempts to handle body properly
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(jest.fn());

      // Use expect().rejects instead of try/catch
      await expect(
        controller.handleWebhook('test_signature', {
          body: { test: 'data' }, // Non-buffer body
          headers: { 'content-type': 'application/json' },
          url: '/test-url',
          method: 'POST',
          originalUrl: '/v1/payments/webhook',
        }),
      ).resolves.toEqual({ success: true });

      // Since the controller handles non-buffer by converting it, we should see a warning
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'Request body is not a buffer, attempting to convert',
      );

      // The service should have been called since the controller converts the body
      expect(paymentService.handleStripeWebhook).toHaveBeenCalled();
    });

    it('should throw an error if no signature is provided', async () => {
      await expect(
        controller.handleWebhook(undefined, {
          body: Buffer.from('test_payload'),
          headers: {
            'content-type': 'application/json',
          },
          url: '/test-url',
          method: 'POST',
          originalUrl: '/v1/payments/webhook',
        }),
      ).rejects.toThrow('No Stripe signature provided');

      expect(Logger.prototype.error).toHaveBeenCalled();
    });

    it('should handle service errors properly', async () => {
      const error = new Error('Test webhook error');
      mockPaymentService.handleStripeWebhook.mockRejectedValue(error);

      await expect(
        controller.handleWebhook('test_signature', {
          body: Buffer.from('test_payload'),
          headers: {
            'content-type': 'application/json',
          },
          url: '/test-url',
          method: 'POST',
          originalUrl: '/v1/payments/webhook',
        }),
      ).rejects.toThrow(error);

      expect(Logger.prototype.error).toHaveBeenCalled();
    });
  });
});
