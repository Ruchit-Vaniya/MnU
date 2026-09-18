'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { menuApi, ordersApi, type OrderConfirmation, type PublicMenu } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { hasCustomerToken } from '@/lib/customerAuth';
import { getActiveGroupCode } from '@/lib/groupOrder';
import { CustomerAuthPanel } from '../_components/CustomerAuthPanel';

// Cart → Review Order → Place Order → Order Confirmation, all in one
// component (two visual states) rather than a separate confirmation
// route — Day 12 doesn't add a "get order by id" endpoint, since the
// create-order response already has everything the confirmation view
// needs. One consequence, documented in docs/PROGRESS.md: refreshing
// this page after a successful order loses the confirmation view (the
// cart's already been cleared by then) — acceptable for today's scope,
// not a persistent order-lookup product yet.
export default function OrderReviewPage() {
  const params = useParams<{ restaurantId: string }>();
  const searchParams = useSearchParams();
  const { restaurantId } = params;
  const tableNumber = searchParams.get('table');
  const tableId = searchParams.get('tableId');
  const contextQuery = (() => {
    const qs = new URLSearchParams();
    if (tableNumber) qs.set('table', tableNumber);
    if (tableId) qs.set('tableId', tableId);
    const str = qs.toString();
    return str ? `?${str}` : '';
  })();

  const { items, subtotal, clearCart } = useCart(restaurantId);
  const [menu, setMenu] = useState<PublicMenu | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<OrderConfirmation | null>(null);
  // Part 3/5: checked once on mount, client-side, purely to decide which
  // screen to render — the actual security boundary is
  // CustomerAuthGuard on the backend create-order call, which re-verifies
  // the token regardless of what this flag says.
  const [customerAuthed, setCustomerAuthed] = useState(false);
  // If this browser is part of a group, solo checkout must not happen —
  // that's exactly what produced one order per person for a single
  // table. Read in an effect, not during render, because localStorage
  // doesn't exist during SSR.
  const [activeGroupCode, setActiveGroupCodeState] = useState<string | null>(null);
  const [groupChecked, setGroupChecked] = useState(false);

  useEffect(() => {
    setActiveGroupCodeState(getActiveGroupCode(restaurantId));
    setGroupChecked(true);
  }, [restaurantId]);

  useEffect(() => {
    setCustomerAuthed(hasCustomerToken());
  }, []);

  useEffect(() => {
    menuApi
      .getPublicMenu(restaurantId)
      .then(setMenu)
      .catch((err) => setMenuError(err instanceof Error ? err.message : 'Failed to load restaurant.'));
  }, [restaurantId]);

  const placeOrder = async () => {
    if (!tableId) return;
    setSubmitting(true);
    setOrderError(null);
    try {
      const result = await ordersApi.create(
        restaurantId,
        tableId,
        items.map((i) => ({ itemId: i.itemId, quantity: i.quantity })),
      );
      clearCart();
      setConfirmation(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to place order.';
      // A session that expired between verifying and placing the order
      // (rare, but possible with a 30d-lived token if the clock/device
      // changes) surfaces as this exact message from CustomerAuthGuard —
      // send them back through verification rather than showing a dead
      // "Place Order" button.
      if (message.includes('verify your mobile number or email')) {
        setCustomerAuthed(false);
      }
      setOrderError(message);
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Confirmation view (after a successful order) ----
  if (confirmation) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div className="w-full max-w-sm rounded-card border border-hairline bg-surface p-8 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-2xl">
            ✓
          </div>
          <h1 className="text-lg font-bold text-carbon-900">Order placed!</h1>
          <p className="mt-1 text-sm text-carbon-400">
            The kitchen at {confirmation.restaurant.name} has received your order.
          </p>

          <div className="mt-5 space-y-2 rounded-xl bg-canvas p-4 text-left text-sm">
            <div className="flex justify-between">
              <span className="text-carbon-400">Order</span>
              <span className="font-semibold text-carbon-900">{confirmation.orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-carbon-400">Table</span>
              <span className="font-semibold text-carbon-900">{confirmation.table.tableNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-carbon-400">Status</span>
              <span className="font-semibold text-carbon-900">{confirmation.status}</span>
            </div>
            <div className="flex justify-between border-t border-hairline pt-2">
              <span className="text-carbon-400">Total</span>
              <span className="font-bold text-carbon-900">₹{confirmation.total}</span>
            </div>
          </div>

          <Link
            href={`/menu/${restaurantId}${contextQuery}`}
            className="mt-6 block w-full rounded-xl border border-hairline px-4 py-3 text-sm font-semibold text-carbon-700"
          >
            Back to Menu
          </Link>
        </div>
      </main>
    );
  }

  // ---- No table context at all — can't place an order ----
  if (!tableId) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-card border border-hairline bg-surface p-8 text-center shadow-sm">
          <p className="text-sm text-carbon-700">We couldn&apos;t find your table.</p>
          <p className="mt-1 text-xs text-carbon-400">Please scan the table QR code again.</p>
        </div>
      </main>
    );
  }

  // ---- In a group: solo checkout is blocked ----
  // The whole point of a group order is that the table sends ONE order.
  // Letting this page also submit would recreate the duplicate-orders
  // bug, so it redirects into the lobby instead of offering a second
  // way to check out.
  if (groupChecked && activeGroupCode) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-card border border-hairline bg-surface p-8 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-terracotta-50 text-xl">
            👥
          </div>
          <p className="text-sm font-semibold text-carbon-900">You&apos;re in a group order</p>
          <p className="mt-1 text-sm text-carbon-400">
            Your table sends one order together, so checkout happens in the group — not here.
          </p>
          <Link
            href={`/menu/${restaurantId}/group/${activeGroupCode}${contextQuery}`}
            className="mt-5 block w-full rounded-xl bg-terracotta-500 px-4 py-3 text-sm font-bold text-white active:scale-[0.99]"
          >
            Go to group order
          </Link>
        </div>
      </main>
    );
  }

  // ---- Empty cart ----
  if (items.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-card border border-dashed border-hairline bg-surface p-8 text-center">
          <p className="text-sm text-carbon-400">Your cart is empty.</p>
          <Link
            href={`/menu/${restaurantId}${contextQuery}`}
            className="mt-3 inline-block text-sm font-semibold text-terracotta-600"
          >
            Browse the menu →
          </Link>
        </div>
      </main>
    );
  }

  // ---- Loading restaurant name ----
  if (!menu && !menuError) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-carbon-400">Loading...</p>
      </main>
    );
  }

  // ---- Customer authentication (Part 3) ----
  // Sits between Cart and Order in the flow, exactly as specified — the
  // customer already browsed the menu and built a cart with zero login
  // friction; this is the only point that requires it. Cart items,
  // table/session context, and even this exact page are all untouched
  // across verification (see CustomerAuthPanel's comment).
  if (!customerAuthed) {
    return (
      <main className="mx-auto min-h-screen max-w-md bg-canvas px-4 pb-8 pt-6">
        <Link
          href={`/menu/${restaurantId}/cart${contextQuery}`}
          className="mb-3 inline-block text-sm font-semibold text-carbon-700"
        >
          ← Cart
        </Link>
        <CustomerAuthPanel
          restaurantName={menu?.restaurantName ?? 'this restaurant'}
          onVerified={() => setCustomerAuthed(true)}
        />
      </main>
    );
  }

  // ---- Review ----
  return (
    <main className="mx-auto min-h-screen max-w-md bg-canvas px-4 pb-8 pt-6">
      {/* Day 14, Part 3: consistent "how do I get back" affordance —
          every other customer screen (Home, Menu, Cart) has one. */}
      <Link
        href={`/menu/${restaurantId}/cart${contextQuery}`}
        className="mb-3 inline-block text-sm font-semibold text-carbon-700"
      >
        ← Cart
      </Link>
      <h1 className="text-xl font-bold text-carbon-900">Review Order</h1>
      <p className="mb-5 text-sm text-carbon-400">
        {menu?.restaurantName ?? 'Restaurant'}
        {tableNumber && <span> · Table {tableNumber}</span>}
      </p>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.itemId}
            className="flex items-center justify-between rounded-card border border-hairline bg-surface p-4"
          >
            <div className="min-w-0 pr-3">
              <p className="font-medium text-carbon-900">{item.name}</p>
              <p className="mt-0.5 text-xs text-carbon-400">
                ₹{item.price} × {item.quantity}
              </p>
            </div>
            <p className="shrink-0 font-semibold text-carbon-900">₹{item.price * item.quantity}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-1.5 rounded-card border border-hairline bg-surface p-4 text-sm">
        <div className="flex justify-between text-carbon-400">
          <span>Subtotal</span>
          <span>₹{subtotal}</span>
        </div>
        <div className="flex justify-between border-t border-hairline pt-1.5 text-base font-bold text-carbon-900">
          <span>Total</span>
          <span>₹{subtotal}</span>
        </div>
      </div>

      {orderError && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{orderError}</p>
      )}

      <button
        onClick={placeOrder}
        disabled={submitting}
        className="mt-4 w-full rounded-xl bg-terracotta-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {submitting ? 'Placing order...' : 'Place Order'}
      </button>
    </main>
  );
}
