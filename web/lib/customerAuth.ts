// Global (not per-restaurant) on purpose — a customer's identity isn't
// tied to one restaurant (Part 8), so recognizing them shouldn't be
// either. Part 6 (preserve QR/table context) falls out of this for
// free: nothing here touches the cart (keyed by restaurantId in
// lib/cart.ts) or the table/session query params, so authenticating
// never disturbs either.
const CUSTOMER_TOKEN_KEY = 'mnu_customer_token';

export function getCustomerToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CUSTOMER_TOKEN_KEY);
}

export function setCustomerToken(token: string) {
  localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
}

export function clearCustomerToken() {
  localStorage.removeItem(CUSTOMER_TOKEN_KEY);
}

export function hasCustomerToken(): boolean {
  return Boolean(getCustomerToken());
}
