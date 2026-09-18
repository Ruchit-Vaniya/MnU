'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { groupOrdersApi, type GroupOrderRecord, type GroupPlacedOrder } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { hasCustomerToken } from '@/lib/customerAuth';
import { clearActiveGroupCode, setActiveGroupCode } from '@/lib/groupOrder';
import { GroupShell } from '../_components/GroupShell';

// The group lobby. Shows who's at the table, what each person has added,
// and the combined total.
//
// Part 7 ("My Items" vs "Group Items") is handled without a second cart
// system: lib/cart.ts (localStorage) remains the customer's own working
// cart, and "Share with group" pushes it into their slot on the server.
// So "My Items" is the caller's own shared contribution, "Group Items"
// is everyone else's. Deliberately an explicit push, not a live sync —
// real-time collaboration is out of scope, and a silent background sync
// would make it unclear what the rest of the table can already see.
export default function GroupLobbyPage() {
  const params = useParams<{ restaurantId: string; groupCode: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { restaurantId, groupCode } = params;

  const tableNumber = searchParams.get('table');
  const tableId = searchParams.get('tableId');
  const contextQuery = (() => {
    const qs = new URLSearchParams();
    if (tableNumber) qs.set('table', tableNumber);
    if (tableId) qs.set('tableId', tableId);
    const str = qs.toString();
    return str ? `?${str}` : '';
  })();

  const { items: cartItems, count: cartCount, subtotal: cartSubtotal, clearCart } = useCart(restaurantId);

  const [group, setGroup] = useState<GroupOrderRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<GroupPlacedOrder | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    if (!hasCustomerToken()) {
      router.replace(`/menu/${restaurantId}/group${contextQuery}`);
      return;
    }
    setError(null);
    try {
      const data = await groupOrdersApi.get(restaurantId, groupCode);
      setGroup(data);
      setActiveGroupCode(restaurantId, data.groupCode);
    } catch (err) {
      // An invalid/expired/foreign code lands here. Clear the remembered
      // code so the customer isn't bounced back into a dead lobby on
      // every subsequent visit.
      clearActiveGroupCode(restaurantId);
      setError(err instanceof Error ? err.message : 'Could not load this group.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, groupCode]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const handleShare = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const updated = await groupOrdersApi.syncMyItems(
        restaurantId,
        groupCode,
        cartItems.map((i) => ({ itemId: i.itemId, quantity: i.quantity })),
      );
      setGroup(updated);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Could not share your items.');
    } finally {
      setSyncing(false);
    }
  };

  const handlePlaceOrder = async () => {
    setPlacing(true);
    setPlaceError(null);
    try {
      const order = await groupOrdersApi.placeOrder(restaurantId, groupCode);
      setPlaced(order);
      // The personal cart's job is done — the group order now owns these
      // items. Leaving it populated would let the customer wander back
      // into solo checkout with a stale copy of what they already
      // ordered.
      clearCart();
      clearActiveGroupCode(restaurantId);
    } catch (err) {
      setPlaceError(err instanceof Error ? err.message : 'Could not place the group order.');
    } finally {
      setPlacing(false);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(groupCode.toUpperCase());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be unavailable (insecure context, permissions).
      // The code is displayed in large type right above the button, so
      // there's nothing to recover from — reading it off the screen
      // works fine.
    }
  };

  const menuHref = `/menu/${restaurantId}${contextQuery}`;
  const backHref = `/menu/${restaurantId}/home${contextQuery}`;

  // ---- Group order placed: one combined order for the whole table ----
  if (placed) {
    return (
      <GroupShell title="Order Placed" backHref={backHref} bottomPadding="pb-12">
        <div className="rounded-card border border-hairline bg-surface p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success-500/10 text-2xl">
            ✓
          </div>
          <h2 className="text-lg font-extrabold text-carbon-900">Group order sent</h2>
          <p className="mt-1 text-sm text-carbon-400">
            One order for your whole table — {placed.memberCount} {placed.memberCount === 1 ? 'person' : 'people'}.
          </p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-carbon-400">Order number</p>
          <p className="text-2xl font-extrabold tracking-wide text-carbon-900">{placed.orderNumber}</p>
          <p className="mt-1 text-xs text-carbon-400">
            Table {placed.table.tableNumber} · {placed.status}
          </p>
        </div>

        <section className="mt-4 rounded-card border border-hairline bg-surface p-5">
          <h3 className="text-sm font-bold text-carbon-900">What the table ordered</h3>
          <ul className="mt-3 space-y-2">
            {placed.items.map((item, idx) => (
              <li key={`${item.name}-${idx}`} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate text-carbon-900">
                    {item.name} <span className="text-carbon-400">× {item.quantity}</span>
                  </span>
                  {item.addedByName && (
                    <span className="block text-xs text-carbon-400">for {item.addedByName}</span>
                  )}
                </span>
                <span className="shrink-0 font-semibold text-carbon-900">₹{item.lineTotal}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-baseline justify-between border-t border-hairline pt-3">
            <span className="text-sm font-semibold text-carbon-700">Total</span>
            <span className="text-xl font-extrabold text-carbon-900">₹{placed.total}</span>
          </div>
        </section>

        <Link
          href={menuHref}
          className="mt-4 block w-full rounded-xl border border-hairline bg-surface px-4 py-3.5 text-center text-sm font-bold text-carbon-900 active:scale-[0.99]"
        >
          Back to menu
        </Link>
      </GroupShell>
    );
  }

  if (error) {
    return (
      <GroupShell title="Group Order" backHref={backHref} bottomPadding="pb-12">
        <div className="rounded-card border border-hairline bg-surface p-8 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-xl">
            ⚠️
          </div>
          <p className="text-sm font-semibold text-carbon-900">This group isn&apos;t available</p>
          <p className="mt-1 text-sm text-carbon-400">{error}</p>
          <div className="mt-5 space-y-2">
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="w-full rounded-xl border border-hairline px-4 py-3 text-sm font-semibold text-carbon-900 active:scale-[0.99]"
            >
              Try again
            </button>
            <Link
              href={`/menu/${restaurantId}/group${contextQuery}`}
              className="block w-full rounded-xl bg-terracotta-500 px-4 py-3 text-center text-sm font-bold text-white active:scale-[0.99]"
            >
              Back to Group Order
            </Link>
          </div>
        </div>
      </GroupShell>
    );
  }

  if (!group) {
    return (
      <GroupShell title="Group Order" backHref={backHref} bottomPadding="pb-12">
        <div className="animate-pulse space-y-3">
          <div className="h-28 rounded-card border border-hairline bg-surface" />
          <div className="h-36 rounded-card border border-hairline bg-surface" />
          <div className="h-24 rounded-card border border-hairline bg-surface" />
        </div>
      </GroupShell>
    );
  }

  const alreadyOrdered = group.status !== 'OPEN';
  const me = group.members.find((m) => m.isYou);
  const others = group.members.filter((m) => !m.isYou);
  const othersWithItems = others.filter((m) => m.items.length > 0);
  // "Is what I've shared different from what's in my cart right now?" —
  // drives the prompt below. Compares quantity-per-item, not order.
  const sharedMap = new Map((me?.items ?? []).map((i) => [i.menuItemId, i.quantity]));
  const cartMap = new Map(cartItems.map((i) => [i.itemId, i.quantity]));
  const hasUnsharedChanges =
    sharedMap.size !== cartMap.size ||
    [...cartMap].some(([id, qty]) => sharedMap.get(id) !== qty);

  return (
    <GroupShell
      title="Group Order"
      subtitle={tableNumber ? `Table ${tableNumber}` : null}
      backHref={backHref}
    >
      {/* Group code — the single most-needed thing on this screen, so it
          leads, in large type, tap-to-copy. */}
      <div className="rounded-card border border-hairline bg-surface p-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-carbon-400">Group Code</p>
        <p className="mt-1 text-4xl font-extrabold tracking-[0.2em] text-carbon-900">
          {group.groupCode}
        </p>
        <button
          type="button"
          onClick={handleCopyCode}
          className="mt-3 rounded-full border border-hairline px-4 py-2 text-xs font-bold text-carbon-700 active:bg-canvas-deep"
        >
          {copied ? 'Copied ✓' : 'Copy code'}
        </button>
        <p className="mt-2 text-xs text-carbon-400">Share this with everyone at your table</p>
      </div>

      {/* Members */}
      <section className="mt-4 rounded-card border border-hairline bg-surface p-5">
        <h2 className="text-sm font-bold text-carbon-900">
          At this table · {group.members.length}
        </h2>
        <ul className="mt-3 space-y-2.5">
          {group.members.map((member) => (
            <li key={member.customerId} className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  member.isYou ? 'bg-terracotta-500 text-white' : 'bg-canvas text-carbon-700'
                }`}
              >
                {(member.displayName ?? '?').trim().charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-carbon-900">
                  {member.displayName ?? 'Guest'}
                  {member.isYou && <span className="ml-1.5 text-xs font-bold text-terracotta-600">You</span>}
                </p>
                <p className="text-xs text-carbon-400">
                  {member.items.length === 0
                    ? 'No items yet'
                    : `${member.items.reduce((s, i) => s + i.quantity, 0)} item${
                        member.items.reduce((s, i) => s + i.quantity, 0) === 1 ? '' : 's'
                      } · ₹${member.memberTotal}`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* My Items — the caller's own shared contribution */}
      <section className="mt-4 rounded-card border border-hairline bg-surface p-5">
        <h2 className="text-sm font-bold text-carbon-900">My Items</h2>
        {me && me.items.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {me.items.map((item) => (
              <li key={item.menuItemId} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-carbon-900">
                  {item.name} <span className="text-carbon-400">× {item.quantity}</span>
                </span>
                <span className="shrink-0 font-semibold text-carbon-900">₹{item.lineTotal}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-carbon-400">
            You haven&apos;t shared anything with the group yet.
          </p>
        )}

        {hasUnsharedChanges && !alreadyOrdered && (
          <div className="mt-4 rounded-xl bg-canvas p-3">
            <p className="text-xs text-carbon-700">
              {cartCount > 0
                ? `Your cart has ${cartCount} item${cartCount === 1 ? '' : 's'} (₹${cartSubtotal}) that the group can't see yet.`
                : 'Your cart is empty — sharing will remove your items from the group.'}
            </p>
            <button
              type="button"
              onClick={handleShare}
              disabled={syncing}
              className="mt-2.5 w-full rounded-lg bg-terracotta-500 px-4 py-2.5 text-xs font-bold text-white active:scale-[0.99] disabled:opacity-50"
            >
              {syncing ? 'Sharing…' : 'Share my items with the group'}
            </button>
          </div>
        )}

        {syncError && (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600" role="alert">
            {syncError}
          </p>
        )}
      </section>

      {/* Group Items — everyone else's contributions */}
      <section className="mt-4 rounded-card border border-hairline bg-surface p-5">
        <h2 className="text-sm font-bold text-carbon-900">Group Items</h2>
        {othersWithItems.length === 0 ? (
          <p className="mt-2 text-sm text-carbon-400">
            Nobody else has added anything yet.
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {othersWithItems.map((member) => (
              <div key={member.customerId}>
                <p className="text-xs font-semibold text-carbon-400">{member.displayName ?? 'Guest'}</p>
                <ul className="mt-1.5 space-y-2">
                  {member.items.map((item) => (
                    <li
                      key={item.menuItemId}
                      className="flex items-baseline justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0 truncate text-carbon-900">
                        {item.name} <span className="text-carbon-400">× {item.quantity}</span>
                      </span>
                      <span className="shrink-0 font-semibold text-carbon-900">₹{item.lineTotal}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Group total + actions. Not a fixed bar — this page has no bottom
          nav (it's a focused sub-flow, same as Review/Confirmation), and
          adding one here would create the competing-sticky-bars problem
          Part 11 explicitly warns against. */}
      <section className="mt-4 rounded-card border border-terracotta-100 bg-terracotta-50 p-5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-carbon-700">Group Cart</span>
          <span className="text-2xl font-extrabold text-carbon-900">₹{group.groupTotal}</span>
        </div>

        {alreadyOrdered ? (
          <div className="mt-4 rounded-xl border border-hairline bg-surface p-4 text-center">
            <p className="text-sm font-semibold text-carbon-900">This group order has been placed</p>
            {group.placedOrderNumber && (
              <p className="mt-1 text-sm text-carbon-400">Order {group.placedOrderNumber}</p>
            )}
          </div>
        ) : (
          <>
            <Link
              href={menuHref}
              className="mt-4 block w-full rounded-xl border border-hairline bg-surface px-4 py-3.5 text-center text-sm font-bold text-carbon-900 active:scale-[0.99]"
            >
              Add Items
            </Link>

            {placeError && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600" role="alert">
                {placeError}
              </p>
            )}

            {/* One button, one order. Any member can submit on the
                group's behalf; the server is idempotent, so two people
                tapping at once still produces a single order. */}
            <button
              type="button"
              onClick={handlePlaceOrder}
              disabled={placing || group.groupTotal === 0}
              className="mt-2 w-full rounded-xl bg-terracotta-500 px-4 py-3.5 text-sm font-bold text-white active:scale-[0.99] disabled:opacity-40"
            >
              {placing ? 'Placing order…' : 'Place Group Order'}
            </button>

            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="mt-2 w-full rounded-xl bg-transparent px-4 py-2.5 text-xs font-semibold text-carbon-400"
            >
              Refresh group
            </button>

            <p className="mt-2 text-center text-xs text-carbon-400">
              {group.groupTotal === 0
                ? 'Add items before placing the order.'
                : 'Sends one order for the whole table. Make sure everyone has shared their items.'}
            </p>
          </>
        )}
      </section>
    </GroupShell>
  );
}
