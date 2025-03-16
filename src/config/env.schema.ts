import { z } from 'zod';

export const envSchema = z.object({
  // Application
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z
    .string()
    .transform((val) => {
      const parsed = Number(val);
      if (isNaN(parsed) || parsed <= 0 || parsed > 65535) {
        throw new Error('PORT must be a valid port number between 1 and 65535');
      }
      return parsed;
    })
    .default('3000'),
  API_PREFIX: z.string().default('api'),
  API_VERSION: z
    .string()
    .transform((val) => {
      const parsed = Number(val);
      if (isNaN(parsed) || parsed <= 0) {
        throw new Error('API_VERSION must be a positive number');
      }
      return parsed;
    })
    .default('1'),

  // Database
  DATABASE_URL: z
    .string()
    .nonempty('DATABASE_URL is required')
    .url('DATABASE_URL must be a valid URL'),

  // JWT
  JWT_SECRET: z
    .string()
    .nonempty('JWT_SECRET is required')
    .min(16, 'JWT_SECRET should be at least 16 characters long for security'),
  JWT_EXPIRATION: z
    .string()
    .nonempty('JWT_EXPIRATION is required')
    .regex(
      /^\d+[smhd]$/,
      'JWT_EXPIRATION must be in format like 7d, 24h, 60m, etc.',
    ),

  // Stripe
  STRIPE_SECRET_KEY: z
    .string()
    .nonempty('STRIPE_SECRET_KEY is required')
    .regex(
      /^sk_(test|live)_[a-zA-Z0-9]+$/,
      'STRIPE_SECRET_KEY must be a valid Stripe secret key',
    ),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .nonempty('STRIPE_WEBHOOK_SECRET is required')
    .regex(
      /^whsec_[a-zA-Z0-9]+$/,
      'STRIPE_WEBHOOK_SECRET must be a valid Stripe webhook secret',
    ),
  DEFAULT_CURRENCY: z
    .string()
    .min(3, 'Currency code should be 3 characters')
    .max(3, 'Currency code should be 3 characters')
    .default('usd'),

  // Booking
  SEAT_LOCK_EXPIRY_MINUTES: z
    .string()
    .transform((val) => {
      const parsed = Number(val);
      if (isNaN(parsed) || parsed <= 0) {
        throw new Error('SEAT_LOCK_EXPIRY_MINUTES must be a positive number');
      }
      return parsed;
    })
    .default('15'),

  // Supabase
  SUPABASE_URL: z
    .string()
    .nonempty('SUPABASE_URL is required')
    .url('SUPABASE_URL must be a valid URL'),
  SUPABASE_KEY: z.string().nonempty('SUPABASE_KEY is required'),

  // Webhook configurations
  WEBHOOK_PATHS: z
    .string()
    .nonempty('WEBHOOK_PATHS is required')
    .refine(
      (val) => val.split(',').every((path) => path.trim().startsWith('/')),
      'All webhook paths must start with "/"',
    ),
});

export type Env = z.infer<typeof envSchema>;
