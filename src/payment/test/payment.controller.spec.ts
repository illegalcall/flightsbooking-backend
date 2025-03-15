import { Test, TestingModule } from '@nestjs/testing';
import { PaymentController } from '../payment.controller';
import { PaymentService } from '../payment.service';
import { CreatePaymentIntentDto } from '../dto';
import { Logger } from '@nestjs/common';

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
        { user: { sub: userId } },
        createDto,
      );

      expect(paymentService.createPaymentIntent).toHaveBeenCalledWith(
        userId,
        createDto,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should handle errors properly', async () => {
      const error = new Error('Test error');
      mockPaymentService.createPaymentIntent.mockRejectedValue(error);

      await expect(
        controller.createPaymentIntent(
          { user: { sub: 'user123' } },
          {} as CreatePaymentIntentDto,
        ),
      ).rejects.toThrow(error);

      expect(Logger.prototype.error).toHaveBeenCalled();
    });
  });

  describe('handleWebhook', () => {
    it('should call the payment service with signature and payload', async () => {
      const signature = 'test_signature';
      const rawBody = Buffer.from('test_payload');
      const expectedResult = { success: true };

      mockPaymentService.handleStripeWebhook.mockResolvedValue(expectedResult);

      const result = await controller.handleWebhook(signature, {
        rawBody,
      } as any);

      expect(paymentService.handleStripeWebhook).toHaveBeenCalledWith(
        signature,
        rawBody,
      );
      expect(result).toEqual(expectedResult);
    });

    it('should throw an error if no raw body is provided', async () => {
      await expect(
        controller.handleWebhook('test_signature', {
          rawBody: undefined,
        } as any),
      ).rejects.toThrow('No raw body provided');

      expect(Logger.prototype.error).toHaveBeenCalled();
    });

    it('should throw an error if no signature is provided', async () => {
      await expect(
        controller.handleWebhook(undefined, {
          rawBody: Buffer.from('test_payload'),
        } as any),
      ).rejects.toThrow('No Stripe signature provided');

      expect(Logger.prototype.error).toHaveBeenCalled();
    });

    it('should handle service errors properly', async () => {
      const error = new Error('Test webhook error');
      mockPaymentService.handleStripeWebhook.mockRejectedValue(error);

      await expect(
        controller.handleWebhook('test_signature', {
          rawBody: Buffer.from('test_payload'),
        } as any),
      ).rejects.toThrow(error);

      expect(Logger.prototype.error).toHaveBeenCalled();
    });
  });
});
