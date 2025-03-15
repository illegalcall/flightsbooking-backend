import { CabinClass } from '@prisma/client';
import { CabinClassMultipliers } from '../booking/dto/cabin-class-config.dto';

/**
 * Default price multipliers for different cabin classes
 */
export const cabinClassConfig: {
  priceMultipliers: CabinClassMultipliers;
} = {
  priceMultipliers: {
    [CabinClass.Economy]: 1.0,
    [CabinClass.PremiumEconomy]: 1.5,
    [CabinClass.Business]: 2.5,
    [CabinClass.First]: 4.0,
  },
};
