'use client';

import Link from 'next/link';
import { ItemImage } from './ItemImage';
import { QuantityControl } from './QuantityControl';

export interface MenuItemCardData {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
}

// Day 22 (Part 7/9) — at most ONE badge per card, resolved by the same
// priority used on Home: Featured beats Popular. A dish that is both
// shows only "Featured". Passing `null` (the default) renders no badge
// at all, which is the case for most of the menu — that's deliberate:
// if everything is highlighted, nothing is.
export type MenuItemBadge = 'featured' | 'popular' | null;

interface MenuItemCardProps {
  item: MenuItemCardData;
  href: string;
  badge?: MenuItemBadge;
  quantity: number;
  onAdd: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
  // Day 23 — purely cosmetic entrance stagger for the first paint of a
  // grid (see menu/[restaurantId]/page.tsx). Optional and capped by the
  // caller; omitting it just skips the entrance delay, never breaks
  // layout.
  animationDelayMs?: number;
}

// VARIANT A — the standard product card, used in the 2-column mobile
// menu grid.
//
// Every item returned by the public menu endpoint is, by definition,
// currently available (unavailable items are excluded server-side — see
// docs/PROGRESS.md, Day 9), so availability stays a quiet sage dot
// rather than a warning banner.
//
// Layout note: the add control is absolutely positioned at the card's
// bottom-right and the text block reserves padding for it, so a long
// item name wrapping to two lines pushes the price down without ever
// colliding with the button.
export function MenuItemCard({
  item,
  href,
  badge = null,
  quantity,
  onAdd,
  onIncrease,
  onDecrease,
  animationDelayMs,
}: MenuItemCardProps) {
  return (
    <div
      style={animationDelayMs !== undefined ? { animationDelay: `${animationDelayMs}ms` } : undefined}
      className={`group relative flex flex-col rounded-card bg-surface p-3 shadow-soft transition duration-200 active:scale-[0.98] sm:hover:shadow-soft-lg ${
        animationDelayMs !== undefined ? 'animate-fade-slide-up' : ''
      } ${
        // Featured gets a ring; Popular does not. The stronger signal
        // gets the stronger treatment, and normal cards stay plain.
        badge === 'featured' ? 'ring-1 ring-terracotta-500/40' : ''
      }`}
    >
      <Link href={href} className="block">
        <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-soft bg-canvas-deep">
          {badge && (
            <span
              className={`absolute left-1.5 top-1.5 z-10 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                badge === 'featured'
                  ? 'bg-terracotta-500 text-white'
                  : 'bg-surface/95 text-carbon-700 shadow-soft'
              }`}
            >
              {badge === 'featured' ? '★ Featured' : 'Popular'}
            </span>
          )}
          <ItemImage
            imageUrl={item.imageUrl}
            seed={item.id || item.name}
            alt={item.name}
            className="h-full w-full rounded-soft transition-transform duration-300 sm:group-hover:scale-105"
            iconClassName="text-4xl"
          />
        </div>
      </Link>

      <Link href={href} className="mt-3 block min-w-0">
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-carbon-900">{item.name}</h3>
        {item.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-carbon-400">
            {item.description}
          </p>
        )}
      </Link>

      {/* pr-11 reserves the footprint of the floating add button. */}
      <div className="mt-2 flex items-end justify-between gap-2 pr-11">
        <div className="min-w-0">
          <p className="text-base font-extrabold text-carbon-900">₹{item.price}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-sage-500">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sage-500" />
            Available
          </p>
        </div>
      </div>

      <div className="absolute bottom-3 right-3">
        <QuantityControl
          label={item.name}
          quantity={quantity}
          onAdd={onAdd}
          onIncrease={onIncrease}
          onDecrease={onDecrease}
          variant={quantity === 0 ? 'round' : 'pill'}
        />
      </div>
    </div>
  );
}
