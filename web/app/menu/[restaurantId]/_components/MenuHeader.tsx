'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { CartIcon, ChevronLeftIcon, CloseIcon, SearchIcon } from './icons';

interface MenuHeaderProps {
  restaurantName: string;
  tableNumber: string | null;
  cartHref: string;
  cartCount: number;
  searchOpen: boolean;
  searchQuery: string;
  onSearchOpenChange: (open: boolean) => void;
  onSearchQueryChange: (query: string) => void;
  // Day 14, Part 3 (customer navigation): optional, so the header stays
  // exactly as it was for anyone not passing it. When provided, shows a
  // small back-chevron to the customer Home page before the restaurant
  // avatar — this is what answers "how do I get back to Home" from the
  // full menu list, without adding a second, competing nav bar.
  homeHref?: string;
}

// Restaurant has no logo field in the schema yet — an initial-letter
// avatar stands in, matching the placeholder approach already used for
// item images (see foodVisual.ts) rather than fabricating a logo asset.
export function MenuHeader({
  restaurantName,
  tableNumber,
  cartHref,
  cartCount,
  searchOpen,
  searchQuery,
  onSearchOpenChange,
  onSearchQueryChange,
  homeHref,
}: MenuHeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const initial = restaurantName.trim().charAt(0).toUpperCase() || 'M';

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-canvas/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        {searchOpen ? (
          <div className="flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-carbon-400" />
              <input
                ref={inputRef}
                type="text"
                inputMode="search"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                placeholder="Search the menu"
                className="w-full rounded-full border border-hairline bg-surface py-2 pl-9 pr-3 text-sm text-carbon-900 outline-none focus:border-brand-500"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                onSearchOpenChange(false);
                onSearchQueryChange('');
              }}
              aria-label="Close search"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-carbon-700"
            >
              <CloseIcon />
            </button>
          </div>
        ) : (
          <>
            {homeHref && (
              <Link
                href={homeHref}
                aria-label="Back to restaurant home"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-carbon-700 active:bg-canvas-deep"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </Link>
            )}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-terracotta-500 text-sm font-bold text-white">
              {initial}
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-bold leading-tight text-carbon-900">
                {restaurantName}
              </h1>
              {tableNumber && (
                <p className="truncate text-xs text-carbon-400">Table {tableNumber}</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => onSearchOpenChange(true)}
              aria-label="Search the menu"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-carbon-700 active:bg-canvas-deep"
            >
              <SearchIcon />
            </button>

            <Link
              href={cartHref}
              aria-label={`Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-carbon-700 active:bg-canvas-deep"
            >
              <CartIcon />
              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta-500 px-1 text-[10px] font-bold text-white">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
