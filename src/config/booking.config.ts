/**
 * Configuration for booking-related features
 */
export const bookingConfig = {
  /**
   * Default expiry time for pending bookings in minutes
   * Bookings that remain in pending status longer than this time will be automatically cancelled
   */
  pendingBookingExpiryMinutes: 30,

  /**
   * Validates the pending booking expiry configuration value
   * @param value The value to validate
   * @returns The validated value or the default value
   */
  validatePendingBookingExpiry: (value: unknown): number => {
    // Check if the value is a number
    if (typeof value !== 'number' && typeof value !== 'string') {
      console.warn(
        `Invalid PENDING_BOOKING_EXPIRY_MINUTES type: expected number, got ${typeof value}. Using default value.`,
      );
      return bookingConfig.pendingBookingExpiryMinutes;
    }

    // Convert to number if it's a string
    const numValue = typeof value === 'string' ? parseInt(value, 10) : value;

    // Check if the value is a valid number
    if (isNaN(numValue)) {
      console.warn(
        `Invalid PENDING_BOOKING_EXPIRY_MINUTES value: cannot be parsed as a number. Using default value.`,
      );
      return bookingConfig.pendingBookingExpiryMinutes;
    }

    // Check if the value is positive
    if (numValue <= 0) {
      console.warn(
        `Invalid PENDING_BOOKING_EXPIRY_MINUTES value: must be positive. Using default value.`,
      );
      return bookingConfig.pendingBookingExpiryMinutes;
    }

    return numValue;
  },
};
