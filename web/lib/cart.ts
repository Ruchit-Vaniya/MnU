'use client';

import { useCallback, useEffect, useState } from 'react';

// Day 11 — a basic, client-side-only cart. No backend model: order
// creation/payment is explicitly out of scope today (see
// docs/PROGRESS.md). Storage is scoped per restaurant
// (`mnu_cart_<restaurantId>`) specifically so cart data can never mix
// between restaurants — a customer's cart for Restaurant A is a
// completely separate localStorage entry from Restaurant B's, even if
// they browse both in the same browser.
export interface CartItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
}

const keyFor = (restaurantId: string) => `mnu_cart_${restaurantId}`;

function readCart(restaurantId: string): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(keyFor(restaurantId));
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function writeCart(restaurantId: string, items: CartItem[]) {
  try {
    localStorage.setItem(keyFor(restaurantId), JSON.stringify(items));
  } catch {
    // Storage can fail (private browsing, quota) — the cart just won't
    // persist across a reload in that case, not worth surfacing as an
    // error for a same-session cart.
  }
}

export function useCart(restaurantId: string) {
  const [items, setItems] = useState<CartItem[]>([]);

  // Re-reads fresh on every mount (including navigating back from an
  // item detail or cart page, since those are separate routes) —
  // deliberately simple rather than a global store, since this app has
  // no cross-tab sync requirement for a single customer's own cart.
  useEffect(() => {
    setItems(readCart(restaurantId));
  }, [restaurantId]);

  const persist = useCallback(
    (next: CartItem[]) => {
      setItems(next);
      writeCart(restaurantId, next);
    },
    [restaurantId],
  );

  const addItem = useCallback(
    (item: { itemId: string; name: string; price: number }, quantity: number) => {
      const current = readCart(restaurantId);
      const existing = current.find((i) => i.itemId === item.itemId);
      const next = existing
        ? current.map((i) =>
            i.itemId === item.itemId ? { ...i, quantity: i.quantity + quantity } : i,
          )
        : [...current, { ...item, quantity }];
      persist(next);
    },
    [restaurantId, persist],
  );

  const setQuantity = useCallback(
    (itemId: string, quantity: number) => {
      const current = readCart(restaurantId);
      // Zero or negative quantity removes the line entirely — this is
      // also what the cart screen's "Remove" action calls under the hood.
      const next =
        quantity <= 0
          ? current.filter((i) => i.itemId !== itemId)
          : current.map((i) => (i.itemId === itemId ? { ...i, quantity } : i));
      persist(next);
    },
    [restaurantId, persist],
  );

  const removeItem = useCallback((itemId: string) => setQuantity(itemId, 0), [setQuantity]);

  // Called after a successful order is placed — the cart's job is done
  // once the order exists in MongoDB; nothing here talks to the order
  // itself, this just empties local storage.
  const clearCart = useCallback(() => {
    persist([]);
  }, [persist]);

  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.price, 0);

  return { items, addItem, setQuantity, removeItem, clearCart, count, subtotal };
}
