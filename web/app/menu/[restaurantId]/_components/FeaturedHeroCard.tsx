'use client';

import Link from 'next/link';
import { ItemImage } from './ItemImage';
import type { MenuItemCardData } from './MenuItemCard';

interface FeaturedHeroCardProps {
  item: MenuItemCardData;
  href: string;
  onAdd: () => void;
}

// VARIANT B — the Home hero. One item, presented large.
//
// The image sits in its own square and uses ItemImage's `float` mode so
// a transparent food PNG reads as a cut-out lifted off the terracotta
// panel. The card itself is overflow-visible ONLY here, for that effect.
//
// The item shown is real menu data chosen by the caller (Home page) —
// no "featured" flag exists in the backend, so nothing here claims
// editorial curation; see docs/PROGRESS.md.
export function FeaturedHeroCard({ item, href, onAdd }: FeaturedHeroCardProps) {
  return (
    <div className="group relative animate-scale-in overflow-visible rounded-hero bg-terracotta-500 p-5 shadow-soft-lg">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <span className="inline-block rounded-full bg-surface/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            Featured
          </span>
          <Link href={href} className="mt-2 block">
            <h2 className="line-clamp-2 text-xl font-extrabold leading-tight text-white">
              {item.name}
            </h2>
          </Link>
          {item.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/80">
              {item.description}
            </p>
          )}
          <p className="mt-3 text-2xl font-extrabold text-white">₹{item.price}</p>
          <button
            type="button"
            onClick={onAdd}
            aria-label={`Add ${item.name} to cart`}
            className="mt-3 rounded-full bg-surface px-5 py-2.5 text-xs font-bold text-terracotta-600 shadow-soft transition active:scale-90"
          >
            Add to order
          </button>
        </div>

        <Link href={href} className="relative block h-32 w-32 shrink-0 sm:h-36 sm:w-36">
          <ItemImage
            imageUrl={item.imageUrl}
            seed={item.id || item.name}
            alt={item.name}
            className="h-full w-full rounded-full transition-transform duration-300 sm:group-hover:scale-105"
            iconClassName="text-5xl"
            float
          />
        </Link>
      </div>
    </div>
  );
}
