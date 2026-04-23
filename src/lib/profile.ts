// ─────────────────────────────────────────────────────────────────────────────
// profile.ts — user profile / saved shipping addresses
//
// Seeded bug:
//   fix-004 (hard 🔴): fetchSavedAddress — async empty-array crash
// ─────────────────────────────────────────────────────────────────────────────

export interface SavedAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
}

interface ProfileResponse {
  userId: string;
  addresses: SavedAddress[];
}

/**
 * Fetch the user's primary saved shipping address from the profile service.
 *
 * SEEDED BUG (fix-004 — hard 🔴):
 *   The profile API returns an empty addresses array for guest / new users.
 *   The function returns response.addresses[0], which is undefined when the
 *   list is empty. The caller then accesses .street on undefined, throwing:
 *     TypeError: Cannot read properties of undefined (reading 'street')
 *
 *   This is an async bug — it surfaces ~800ms after the button click inside a
 *   Promise resolution callback, making the call-site hard to identify from
 *   the stack trace alone.
 */
export async function fetchSavedAddress(): Promise<SavedAddress> {
  // Simulated profile API — returns an empty list for new / guest users
  // (e.g., social-login users who have never saved a shipping address).
  const response = await new Promise<ProfileResponse>(resolve =>
    setTimeout(
      () =>
        resolve({
          userId: 'guest-user',
          addresses: [],   // ← empty for new / guest users
        }),
      800,
    ),
  )

  // BUG: no length guard before index access
  // response.addresses[0] is undefined → caller crashes on .street
  return response.addresses[0]
}
