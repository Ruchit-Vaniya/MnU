'use client';

import Link from 'next/link';
import { ItemImage } from '../../_components/ItemImage';
import { QuantityControl } from '../../_components/QuantityControl';

export interface HomeItemCardData {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
}

interface HomeItemCardProps {
  item: HomeItemCardData;
  href: string;
  quantity: number;
  badge?: string;
  onAdd: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
  // Day 23 — see MenuItemCard's identical prop; same optional entrance
  // stagger, used across the horizontal rails on Home.
  animationDelayMs?: number;
}

// VARIANT C — the carousel / recommendation card.
//
// Kept as a compact vertical card (not a wide horizontal row): these sit
// in a horizontally-scrolling rail, and a horizontal card inside a
// horizontal scroller gives you almost no items per screen on a 375px
// phone. The horizontal-row treatment is what the *cart* and search
// results use instead, where vertical space is the constraint.
export function HomeItemCard({
  item,
  href,
  quantity,
  badge,
  onAdd,
  onIncrease,
  onDecrease,
  animationDelayMs,
}: HomeItemCardProps) {
  return (
    <div
      style={animationDelayMs !== undefined ? { animationDelay: `${animationDelayMs}ms` } : undefined}
      className={`group flex w-40 shrink-0 flex-col rounded-card bg-surface p-3 shadow-soft transition duration-200 active:scale-[0.97] sm:w-44 ${
        animationDelayMs !== undefined ? 'animate-fade-slide-up' : ''
      }`}
    >
      <Link href={href} className="relative block">
        <div className="aspect-square overflow-hidden rounded-soft bg-canvas-deep">
          <ItemImage
            imageUrl={item.imageUrl}
            seed={item.id || item.name}
            alt={item.name}
            className="h-full w-full rounded-soft transition-transform duration-300 sm:group-hover:scale-105"
            iconClassName="text-4xl"
          />
        </div>
        {badge && (
          <span className="absolute left-2 top-2 rounded-full bg-surface/95 px-2 py-0.5 text-[10px] font-bold text-carbon-700 shadow-soft">
            {badge}
          </span>
        )}
      </Link>

      <Link href={href} className="mt-2.5 block min-w-0">
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-carbon-900">{item.name}</h3>
      </Link>

      <div className="mt-auto flex items-center justify-between gap-2 pt-2">
        <p className="text-sm font-extrabold text-carbon-900">₹{item.price}</p>
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
