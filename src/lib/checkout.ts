// ─────────────────────────────────────────────────────────────────────────────
// checkout.ts — order processing logic
//
// SEEDED BUG (fix-001):
//   processOrder() assumes `address` is always defined. When a user skips the
//   address step in CheckoutStepper.tsx, user.address is undefined, and calling
//   processOrder(user.address) throws:
//
//     TypeError: Cannot read properties of undefined (reading 'street')
//
//   This is the failure the Ship Happens loop will diagnose and fix.
// ─────────────────────────────────────────────────────────────────────────────

export interface OrderAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface OrderConfirmation {
  confirmationNumber: string;
  estimatedDelivery: string;
  shippingAddress: string;
}

/**
 * Process an order and return a confirmation.
 *
 * BUG: `address` is typed as `OrderAddress` but callers can pass `undefined`
 * when the user skips the address step. The function has no guard, so accessing
 * `address.street` on the first line throws immediately.
 */
export function processOrder(address: OrderAddress): OrderConfirmation {
  if (!address) {
    throw new Error('Address is required to process the order');
  }
  return {
    confirmationNumber: `SH-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
    estimatedDelivery: new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    shippingAddress: `${address.street}, ${address.city}, ${address.state} ${address.zip}`,
  };
}
