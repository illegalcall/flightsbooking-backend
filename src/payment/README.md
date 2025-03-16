# Payment Module

This module handles payment processing for flight bookings using Stripe as the payment provider.

## Features

- Payment intent creation
- Webhook handling for payment events
- Support for multiple currencies
- Amount verification for fraud prevention

## Configuration

### Environment Variables

The payment module requires several environment variables to function correctly:

| Variable | Description | Default |
|----------|-------------|---------|
| `STRIPE_SECRET_KEY` | Your Stripe API secret key | (required) |
| `STRIPE_WEBHOOK_SECRET` | Secret for verifying Stripe webhook signatures | (required) |
| `DEFAULT_CURRENCY` | Default currency for payments | "usd" |
| `ENABLE_AMOUNT_VERIFICATION` | Enable/disable amount verification | true |
| `ENABLE_ERROR_MONITORING` | Enable external error monitoring | false |
| `WEBHOOK_PATHS` | Comma-separated list of webhook paths that need raw body access | "/payment/webhook" |

### Webhook Configuration

For webhook endpoints that require access to the raw request body (such as Stripe webhooks for signature verification), add the path to the `WEBHOOK_PATHS` environment variable:

```env
# Example: Configure multiple webhook paths
WEBHOOK_PATHS=/payment/webhook,/other/provider/webhook
```

Each path in the comma-separated list will have raw body access enabled, which is necessary for webhook signature verification.

## Security Features

### Amount Verification

The payment service includes amount verification to prevent fraud. When enabled (via `ENABLE_AMOUNT_VERIFICATION`), the service validates that the amount sent by the client matches the actual booking amount in the database.

To use this feature, include the `expectedAmount` parameter when creating a payment intent:

```typescript
// Example client-side code
const response = await paymentService.createPaymentIntent({
  bookingId: "booking-uuid",
  currency: "usd",
  expectedAmount: 199.99 // Must match the actual booking amount
});
```

### Enhanced Error Handling

The webhook handler includes enhanced error handling with:

1. Unique error IDs for each error
2. Detailed logging
3. Integration with external monitoring services (when enabled)
4. Secure error responses that don't expose internal details

## Usage Examples

See the [payment controller](./payment.controller.ts) for usage examples and API endpoints. 