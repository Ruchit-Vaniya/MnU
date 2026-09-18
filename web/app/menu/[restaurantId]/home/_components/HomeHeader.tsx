'use client';

import Link from 'next/link';
import { resolveImageUrl } from '@/lib/api';
import { CartIcon, SearchIcon } from '../../_components/icons';
import type { ResolvedBranding } from '../../_components/branding';

interface HomeHeaderProps {
  restaurantName: string;
  // Day 22 — already resolved/validated upstream (see branding.ts), so
  // this component never has to decide what a missing or malformed
  // colour means.
  branding: ResolvedBranding;
  tableNumber: string | null;
  cartHref: string;
  cartCount: number;
  categoryCount: number;
  itemCount: number;
  // Day 21: search is reachable from the header as well as the nav,
  // because the header is where people look for it. Routes to the
  // existing Menu-page search (`?openSearch=1`) — no new search
  // implementation.
  searchHref: string;
}

// Time-of-day greeting computed on the client from the device clock —
// the restaurant has no timezone field, so this reflects the diner's own
// phone rather than pretending to know the venue's local time.
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function HomeHeader({
  restaurantName,
  branding,
  tableNumber,
  cartHref,
  cartCount,
  categoryCount,
  itemCount,
  searchHref,
}: HomeHeaderProps) {
  const initial = restaurantName.trim().charAt(0).toUpperCase() || 'M';
  const logoSrc = resolveImageUrl(branding.logoUrl);

  return (
    <header className="animate-fade-in px-4 pb-1 pt-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {/* Day 22 — the restaurant's real logo when one is set,
                otherwise the existing initial-letter avatar tinted with
                its brand colour. Restaurant identity doubles as the
                avatar: there is no customer profile photo in the data
                model, and inventing a placeholder persona would be fake
                customer data. */}
            {logoSrc ? (
              <img
                src={logoSrc}
                alt={restaurantName}
                className="h-12 w-12 shrink-0 rounded-hero object-cover shadow-soft"
              />
            ) : (
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-hero text-lg font-extrabold text-white shadow-soft"
                style={{ backgroundColor: branding.primaryColor }}
              >
                {initial}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-carbon-400">{greeting()}</p>
              {/* Restaurant name is the most prominent element in the
                  header, per Day 22 Part 1. */}
              <h1 className="truncate text-2xl font-extrabold leading-tight tracking-tight text-carbon-900">
                {restaurantName}
              </h1>
            </div>
          </div>

          <Link
            href={cartHref}
            aria-label={`Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-soft bg-surface text-carbon-700 shadow-soft transition active:scale-95"
          >
            <CartIcon />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta-500 px-1 text-[10px] font-bold text-white">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Link>
        </div>

        {/* Table + menu-size context. All real, computed values. */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {tableNumber && (
            <span
              className="rounded-full px-3 py-1 text-[11px] font-bold"
              style={{ backgroundColor: `${branding.primaryColor}1A`, color: branding.primaryColor }}
            >
              Table {tableNumber}
            </span>
          )}
          <span className="rounded-full bg-surface px-3 py-1 text-[11px] font-semibold text-carbon-400 shadow-soft">
            {categoryCount} categor{categoryCount === 1 ? 'y' : 'ies'} · {itemCount} item
            {itemCount === 1 ? '' : 's'}
          </span>
        </div>

        {/* Search entry point. Looks like a field, behaves as a link into
            the Menu screen's existing search — deliberately not a second
            search input with its own state to keep in sync. */}
        <Link
          href={searchHref}
          className="mt-4 flex items-center gap-2.5 rounded-hero bg-surface px-4 py-3.5 text-carbon-400 shadow-soft transition active:scale-[0.99]"
        >
          <SearchIcon className="h-4 w-4 shrink-0" />
          <span className="truncate text-sm">Search the menu</span>
        </Link>
      </div>
    </header>
  );
}
