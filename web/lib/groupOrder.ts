'use client';

// Remembers which group (if any) this browser is currently part of, so
// navigating away to the menu and back doesn't lose the lobby.
//
// Scoped per restaurant (`mnu_group_<restaurantId>`) for exactly the
// same reason lib/cart.ts is: a group at Restaurant A must never leak
// into Restaurant B's context. This stores only the *code* — never
// membership or identity, both of which are re-verified server-side on
// every single call (see GroupOrdersService), so a tampered value here
// gets a 404, not access.
const keyFor = (restaurantId: string) => `mnu_group_${restaurantId}`;

export function getActiveGroupCode(restaurantId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(keyFor(restaurantId));
  } catch {
    return null;
  }
}

export function setActiveGroupCode(restaurantId: string, groupCode: string) {
  try {
    localStorage.setItem(keyFor(restaurantId), groupCode);
  } catch {
    // Private browsing / quota — the group still works this session,
    // it just won't be remembered on a reload. Not worth an error UI.
  }
}

export function clearActiveGroupCode(restaurantId: string) {
  try {
    localStorage.removeItem(keyFor(restaurantId));
  } catch {
    // Same as above.
  }
}
