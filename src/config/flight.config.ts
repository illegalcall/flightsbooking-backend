import { CabinClass } from '@prisma/client';

/**
 * Configuration for flight pricing
 */
export const flightPricingConfig = {
  /**
   * Base price multipliers by cabin class
   */
  basePriceMultiplier: {
    [CabinClass.Economy]: 1,
    [CabinClass.PremiumEconomy]: 1.5,
    [CabinClass.Business]: 2.5,
    [CabinClass.First]: 4,
  },

  /**
   * Dynamic multipliers based on occupancy rates
   */
  occupancyMultipliers: [
    { threshold: 0.9, multiplier: 1.5 }, // 50% increase for >90% occupancy
    { threshold: 0.7, multiplier: 1.3 }, // 30% increase for >70% occupancy
    { threshold: 0.5, multiplier: 1.1 }, // 10% increase for >50% occupancy
  ],

  /**
   * Cache time-to-live in seconds for flight search results
   */
  cacheTTL: 300, // 5 minutes
};
