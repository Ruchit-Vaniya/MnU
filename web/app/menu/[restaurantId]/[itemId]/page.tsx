'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { menuApi, type PublicMenu } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { ChevronLeftIcon } from '../_components/icons';
import { ItemImage } from '../_components/ItemImage';
import { MenuErrorState, MenuSkeleton } from '../_components/MenuStates';
import { PageTransition } from '../_components/PageTransition';

type FoundItem = PublicMenu['categories'][number]['items'][number];

// Deliberately reuses menuApi.getPublicMenu() rather than adding a new
// "get single item" endpoint — the full public menu is already small
// (one restaurant's available items) and this avoids a second API
// surface. If the item isn't in the response, it's either nonexistent or
// currently unavailable — the public endpoint already excludes
// unavailable items entirely, so both cases collapse into the same
// "not found" state, which is exactly right: an unavailable item should
// look no different from one that doesn't exist, and definitely can't
// be added to a cart.
export default function MenuItemDetailPage() {
  const params = useParams<{ restaurantId: string; itemId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { restaurantId, itemId } = params;
  const tableNumber = searchParams.get('table');
  const tableId = searchParams.get('tableId');
  const contextQuery = (() => {
    const qs = new URLSearchParams();
    if (tableNumber) qs.set('table', tableNumber);
    if (tableId) qs.set('tableId', tableId);
    const str = qs.toString();
    return str ? `?${str}` : '';
  })();
  const backHref = `/menu/${restaurantId}${contextQuery}`;

  const [menu, setMenu] = useState<PublicMenu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const { addItem } = useCart(restaurantId);

  useEffect(() => {
    setMenu(null);
    setError(null);
    menuApi
      .getPublicMenu(restaurantId)
      .then(setMenu)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load menu.'));
  }, [restaurantId, loadKey]);

  if (error) {
    return <MenuErrorState message={error} onRetry={() => setLoadKey((k) => k + 1)} />;
  }

  if (!menu) {
    return <MenuSkeleton />;
  }

  const item: FoundItem | undefined = menu.categories
    .flatMap((c) => c.items)
    .find((i) => i.id === itemId);

  if (!item) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-card border border-hairline bg-surface p-8 text-center shadow-sm">
          <p className="text-sm text-carbon-700">This item isn&apos;t available right now.</p>
          <Link href={backHref} className="mt-3 inline-block text-xs font-semibold text-terracotta-600">
            ← Back to menu
          </Link>
        </div>
      </main>
    );
  }

  const handleAddToCart = () => {
    addItem({ itemId: item.id, name: item.name, price: item.price }, quantity);
    setAdded(true);
    setTimeout(() => router.push(backHref), 500);
  };

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-canvas pb-8">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 px-4 pt-6 text-sm font-semibold text-carbon-700"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Menu
      </Link>

      <PageTransition>
        {/* Real photo when the admin has uploaded one; otherwise the same
            deterministic placeholder used on the menu grid, shown large.
            Day 23: entrance scale-in so opening a dish reads as the same
            image "growing" from the card rather than an unrelated photo
            appearing — a true shared-element transition (the image
            literally moving from its card position) needs either a
            library or the browser's experimental View Transitions API,
            neither of which this task allows adding/is stably available
            here, so this is the closest same-page equivalent. */}
        <div className="mx-4 mt-3 animate-scale-in">
          <ItemImage
            imageUrl={item.imageUrl}
            seed={item.id || item.name}
            alt={item.name}
            className="h-56 rounded-card sm:h-64"
            iconClassName="text-6xl"
          />
        </div>

        <div className="animate-fade-slide-up px-4 pt-5" style={{ animationDelay: '80ms' }}>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold text-carbon-900">{item.name}</h1>
            <p className="shrink-0 text-xl font-bold text-carbon-900">₹{item.price}</p>
          </div>
          {item.description && <p className="mt-2 text-sm text-carbon-400">{item.description}</p>}
          <p className="mt-3 flex w-fit items-center gap-1.5 rounded-full bg-success-500/10 px-3 py-1 text-xs font-semibold text-success-500">
            <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
            Available
          </p>

          <div className="mt-6 flex items-center gap-4">
            <span className="text-sm font-semibold text-carbon-700">Quantity</span>
            <div className="flex items-center gap-1 rounded-xl border border-hairline p-1">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="flex h-9 w-9 items-center justify-center text-lg font-semibold text-carbon-700 transition active:scale-90 active:bg-canvas-deep"
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span key={quantity} className="w-6 animate-scale-in text-center text-sm font-semibold text-carbon-900">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="flex h-9 w-9 items-center justify-center text-lg font-semibold text-carbon-700 transition active:scale-90 active:bg-canvas-deep"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          </div>

          <button
            onClick={handleAddToCart}
            disabled={added}
            className={`mt-6 w-full rounded-xl bg-terracotta-500 px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-70 ${
              added ? 'scale-[0.98]' : 'active:scale-[0.98]'
            }`}
          >
            {added ? 'Added ✓' : `Add to Cart · ₹${item.price * quantity}`}
          </button>
        </div>
      </PageTransition>
    </main>
  );
}
