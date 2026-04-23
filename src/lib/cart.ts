// ─────────────────────────────────────────────────────────────────────────────
// cart.ts — cart utilities (promo codes, gift messages)
//
// Seeded bugs:
//   fix-002 (easy   🟢): applyPromoCode — undefined property access on unknown code
//   fix-003 (medium 🟡): formatGiftMessage — null crash when text is cleared
// ─────────────────────────────────────────────────────────────────────────────

export interface PromoResult {
  discount: number;
  label: string;
}

const PROMO_DB: Record<string, { percent: number; label: string }> = {
  SAVE10:    { percent: 10, label: '10% off' },
  WELCOME20: { percent: 20, label: '20% off' },
  SUMMER15:  { percent: 15, label: '15% Summer discount' },
}

/**
 * Apply a promotional code and return the discount amount.
 *
 * SEEDED BUG (fix-002 — easy 🟢):
 *   If `code` is not in PROMO_DB, `entry` is undefined.
 *   Accessing `entry.percent` throws:
 *     TypeError: Cannot read properties of undefined (reading 'percent')
 */
export function applyPromoCode(subtotal: number, code: string): PromoResult {
  const entry = PROMO_DB[code.trim().toUpperCase()]
  // Check if entry exists in PROMO_DB
  if (!entry) {
    return { discount: 0, label: 'Invalid promo code' }
  }
  return { discount: (subtotal * entry.percent) / 100, label: entry.label }
}

/**
 * Trim and wrap a gift message for inclusion in the order.
 *
 * SEEDED BUG (fix-003 — medium 🟡):
 *   When the user enables the gift message, types something, then deletes all
 *   the text, the textarea onChange sets giftMsg to null (empty string → null).
 *   Calling msg.trim() on null throws:
 *     TypeError: Cannot read properties of null (reading 'trim')
 */
export function formatGiftMessage(msg: string | null): string {
  // BUG: no null guard — msg.trim() throws when msg is null
  return `🎁 Gift message: "${msg!.trim().slice(0, 120)}"`
}
