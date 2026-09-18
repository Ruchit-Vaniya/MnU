'use client';

import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/lib/cart';
import { ChevronLeftIcon } from '../_components/icons';
import { CustomerBottomNav } from '../_components/CustomerBottomNav';
import { GroupOrderBanner } from '../_components/GroupOrderBanner';
import { PageTransition } from '../_components/PageTransition';

// Day 12: "Review Order" leads to a real order-placement flow at
// /menu/[restaurantId]/review — this page itself still doesn't place an
// order or touch payment, it only forwards to that screen (and only
// once tableId is known — see the check below).
//
// Day 14: added a sticky top header and a sticky bottom checkout bar so
// the total and primary action are always visible without scrolling.
//
// This task: added the shared CustomerBottomNav below the checkout bar
// (two distinct fixed bars stacked on purpose here — the checkout bar
// is this page's own primary action, the nav below it is the same
// persistent Home/Menu/Search/Cart bar every customer screen has). The
// scrollable item list reserves bottom padding sized for both stacked
// together.
export default function CartPage() {
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
  const menuHref = `/menu/${restaurantId}${contextQuery}`;
  const homeHref = `/menu/${restaurantId}/home${contextQuery}`;
  const searchHref = `/menu/${restaurantId}${contextQuery ? `${contextQuery}&` : '?'}openSearch=1`;

  const { items, setQuantity, removeItem, count, subtotal } = useCart(restaurantId);

  return (
    <div className="mnu-customer min-h-screen">
      <header className="sticky top-0 z-20 animate-fade-in border-b border-hairline bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Link
            href={menuHref}
            aria-label="Back to menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-carbon-700 active:bg-canvas-deep"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold leading-tight text-carbon-900">Your Cart</h1>
            {tableNumber && <p className="truncate text-xs text-carbon-400">Table {tableNumber}</p>}
          </div>
          <Link href={homeHref} className="shrink-0 text-xs font-semibold text-terracotta-600">
            Home
          </Link>
        </div>
      </header>

      <main className={`mx-auto max-w-md px-4 pt-4 ${items.length > 0 ? 'pb-64' : 'pb-32'}`}>
        {items.length === 0 ? (
          <div className="mt-6 rounded-card border border-dashed border-hairline bg-surface p-8 text-center">
            <p className="text-sm text-carbon-400">Your cart is empty.</p>
            <Link href={menuHref} className="mt-3 inline-block text-sm font-semibold text-terracotta-600">
              Browse the menu →
            </Link>
          </div>
        ) : (
          <PageTransition className="space-y-3">
            {/* Also surfaced here, not just on Home: the cart is where
                "wait, should we just order together?" tends to occur to
                someone, and it's the last screen before checkout. */}
            <GroupOrderBanner restaurantId={restaurantId} contextQuery={contextQuery} />

            {items.map((item, i) => (
              <div
                key={item.itemId}
                style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}
                className="flex animate-fade-slide-up items-center justify-between rounded-card border border-hairline bg-surface p-4"
              >
                <div className="min-w-0 pr-3">
                  <p className="font-medium text-carbon-900">{item.name}</p>
                  <p className="mt-0.5 text-xs text-carbon-400">
                    ₹{item.price} × {item.quantity}
                  </p>
                  <button
                    onClick={() => removeItem(item.itemId)}
                    className="mt-1.5 text-xs font-semibold text-red-500 transition active:scale-95"
                  >
                    Remove
                  </button>
                </div>
                {/* Day 14: bumped from h-6 (24px) to h-8 (32px) touch
                    targets, matching MenuItemCard's stepper. */}
                <div className="flex shrink-0 items-center gap-1 rounded-xl border border-hairline p-1">
                  <button
                    onClick={() => setQuantity(item.itemId, item.quantity - 1)}
                    className="flex h-8 w-8 items-center justify-center text-lg font-semibold text-carbon-700 transition active:scale-90 active:bg-canvas-deep"
                    aria-label={`Decrease ${item.name} quantity`}
                  >
                    −
                  </button>
                  <span
                    key={item.quantity}
                    className="w-6 animate-scale-in text-center text-sm font-semibold text-carbon-900"
                  >
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(item.itemId, item.quantity + 1)}
                    className="flex h-8 w-8 items-center justify-center text-lg font-semibold text-carbon-700 transition active:scale-90 active:bg-canvas-deep"
                    aria-label={`Increase ${item.name} quantity`}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </PageTransition>
        )}
      </main>

      {/* Sticky checkout bar, positioned just above the bottom nav —
          only rendered with items in the cart, so it never covers the
          empty-cart state. */}
      {items.length > 0 && (
        /* Sits directly above the floating nav, matching its inset and
           radius so the two read as one stacked control rather than a
           full-bleed bar colliding with a floating one. 80px clears the
           nav's own height (52px min + 12px padding + 12px inset). */
        <div className="fixed inset-x-0 bottom-[80px] z-20 animate-fade-slide-up px-3">
          <div className="mx-auto max-w-md rounded-hero bg-surface px-4 pb-4 pt-3 shadow-soft-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-carbon-400">
                {count} item{count > 1 ? 's' : ''}
              </span>
              <span className="text-base font-bold text-carbon-900">Subtotal ₹{subtotal}</span>
            </div>

            {tableId ? (
              <Link
                href={`/menu/${restaurantId}/review${contextQuery}`}
                className="mt-3 block w-full rounded-xl bg-terracotta-500 px-4 py-3 text-center text-sm font-semibold text-white active:scale-[0.99]"
              >
                Review Order
              </Link>
            ) : (
              <>
                <button
                  disabled
                  className="mt-3 w-full cursor-not-allowed rounded-xl bg-canvas-deep px-4 py-3 text-sm font-semibold text-carbon-400"
                >
                  Review Order
                </button>
                <p className="mt-1.5 text-center text-xs text-carbon-400">Scan the table QR code to order.</p>
              </>
            )}
          </div>
        </div>
      )}

      <CustomerBottomNav
        homeHref={homeHref}
        menuHref={menuHref}
        searchHref={searchHref}
        cartHref={`/menu/${restaurantId}/cart${contextQuery}`}
        active="cart"
        cartCount={count}
        cartSubtotal={subtotal}
      />
    </div>
  );
}
