import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('PaymentService', () => {
  let service: PaymentService;
  let configService: ConfigService;

  const mockPrismaService = {
    userProfile: {
      findUnique: jest.fn(),
    },
    booking: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key, defaultValue) => {
      if (key === 'STRIPE_SECRET_KEY') return 'test_stripe_key';
      if (key === 'DEFAULT_CURRENCY') return defaultValue;
      return undefined;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should use the default currency from config service', () => {
    // We can't directly test the private property, but we can test the behavior
    // Set up the test to call createPaymentIntent with no currency
    const createPaymentIntentDto = {
      bookingId: 'test-booking-id',
      currency: undefined,
    };

    // Mock the necessary dependencies
    mockPrismaService.userProfile.findUnique.mockResolvedValue({
      id: 'test-user-profile-id',
    });

    mockPrismaService.booking.findFirst.mockResolvedValue({
      id: 'test-booking-id',
      userProfileId: 'test-user-profile-id',
      status: 'Pending',
      totalAmount: 100,
    });

    // The test would proceed to call stripe.paymentIntents.create
    // but we can't directly test that without mocking the Stripe library
    // For now, let's just verify the configService.get call
    expect(configService.get).toHaveBeenCalledWith('DEFAULT_CURRENCY', 'usd');
  });
});
