import { z } from 'zod';

export const envSchema = z.object({
  // Application
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.string().transform(Number).default('3000'),
  API_PREFIX: z.string().default('api'),
  API_VERSION: z.string().transform(Number).default('1'),

  // Database
  DATABASE_URL: z.string(),

  // JWT
  JWT_SECRET: z.string(),
  JWT_EXPIRATION: z.string(),

  // Stripe
  STRIPE_SECRET_KEY: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string(),
  DEFAULT_CURRENCY: z.string().default('usd'),

  // Booking
  SEAT_LOCK_EXPIRY_MINUTES: z.string().transform(Number).default('15'),

  // Supabase
  SUPABASE_URL: z.string(),
  SUPABASE_KEY: z.string(),
});

export type Env = z.infer<typeof envSchema>;
