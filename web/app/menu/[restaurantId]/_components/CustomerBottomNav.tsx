'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CartIcon, HomeNavIcon, MenuNavIcon, SearchIcon } from './icons';

export type CustomerNavTab = 'home' | 'menu' | 'search' | 'cart';

const TABS: CustomerNavTab[] = ['home', 'menu', 'search', 'cart'];

interface CustomerBottomNavProps {
  homeHref: string;
  menuHref: string;
  searchHref: string;
  cartHref: string;
  active: CustomerNavTab;
  cartCount: number;
  cartSubtotal: number;
}

// The one persistent, app-like navigation surface across Home, Menu,
// and Cart (Part 3's "Home / Menu / Search / Cart", this task). A
// single fixed element per page — the cart summary strip and the tab
// bar are rendered together here as one unit, specifically so a page
// never has two competing fixed-bottom pieces (that was the reason Day
// 14 chose header-based nav instead of a bottom bar; today's explicit
// ask for a bottom nav is handled by folding the old standalone
// StickyCartBar into this same fixed block rather than stacking a
// second one on top of it).
//
// Day 21: restyled as a FLOATING dark bar (night #111) with a rounded
// container and a max width, inset from the screen edges on every
// breakpoint (not just desktop). Tabs are 4 across at >=56px touch
// height. The cart strip still rides on top of the same fixed block, so
// there is still exactly ONE fixed bottom element per screen — pages
// reserve bottom padding for its full height.
//
// "Search" isn't a separate page/fetch — it's the existing Menu page's
// in-header search UI (Day 13), reached here via `searchHref`
// (`/menu/[id]?...&openSearch=1`), which the Menu page reads on mount
// to open search immediately. No new search logic, no duplicate menu
// fetch.
export function CustomerBottomNav({
  homeHref,
  menuHref,
  searchHref,
  cartHref,
  active,
  cartCount,
  cartSubtotal,
}: CustomerBottomNavProps) {
  // Day 23 (Part 11) — cart badge bumps once whenever the count actually
  // increases (not on every render/navigation), so adding an item is
  // felt in the nav even if the customer isn't looking at the button
  // that added it.
  const [bump, setBump] = useState(false);
  const prevCount = useRef(cartCount);
  useEffect(() => {
    if (cartCount > prevCount.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 320);
      prevCount.current = cartCount;
      return () => clearTimeout(t);
    }
    prevCount.current = cartCount;
  }, [cartCount]);

  const activeIndex = TABS.indexOf(active);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 pb-3">
      <div className="pointer-events-auto mx-auto w-full max-w-md">
        {cartCount > 0 && active !== 'cart' && (
          <Link
            href={cartHref}
            className="mb-2 flex animate-fade-slide-up items-center justify-between gap-3 rounded-hero bg-terracotta-500 px-4 py-3 text-white shadow-soft-lg transition active:scale-[0.99]"
          >
            <span className="flex items-center gap-2 text-xs font-bold">
              <CartIcon className="h-4 w-4" />
              {cartCount} item{cartCount > 1 ? 's' : ''} · ₹{cartSubtotal}
            </span>
            <span className="text-xs font-extrabold">View Cart →</span>
          </Link>
        )}

        <nav
          aria-label="Customer navigation"
          className="relative grid grid-cols-4 rounded-hero bg-night px-1.5 py-1.5 shadow-nav"
        >
          {/* Day 23 (Part 11) — one shared pill that slides between tabs
              via a CSS transform transition, instead of each tab simply
              swapping its own background on/off. This is the "smooth
              active-state movement" the task asks for, done with a
              single element rather than animating four independently. */}
          {activeIndex >= 0 && (
            <span
              aria-hidden="true"
              className="absolute inset-y-1.5 left-1.5 w-1/4 rounded-soft bg-surface/10 transition-transform duration-300 ease-out"
              style={{ transform: `translateX(${activeIndex * 100}%)` }}
            />
          )}
          <NavTab href={homeHref} label="Home" active={active === 'home'} icon={<HomeNavIcon />} />
          <NavTab href={menuHref} label="Menu" active={active === 'menu'} icon={<MenuNavIcon />} />
          <NavTab href={searchHref} label="Search" active={active === 'search'} icon={<SearchIcon />} />
          <NavTab
            href={cartHref}
            label="Cart"
            active={active === 'cart'}
            icon={<CartIcon />}
            badge={cartCount > 0 ? cartCount : undefined}
            badgeBump={bump}
          />
        </nav>
      </div>
    </div>
  );
}

function NavTab({
  href,
  label,
  active,
  icon,
  badge,
  badgeBump,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: React.ReactNode;
  badge?: number;
  badgeBump?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={`relative z-10 flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-soft text-[10px] font-bold transition-all duration-200 active:scale-90 ${
        active ? 'text-white' : 'text-white/55 active:bg-surface/5'
      }`}
    >
      <span className="relative">
        {icon}
        {badge !== undefined && (
          <span
            className={`absolute -right-2 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-terracotta-500 px-1 text-[9px] font-bold text-white ${
              badgeBump ? 'animate-pop' : ''
            }`}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
      {label}
    </Link>
  );
}
