'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { menuApi, ordersApi, type PopularItemRecord, type PublicMenu } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { HomeHeader } from './_components/HomeHeader';
import { HomeSection } from './_components/HomeSection';
import { HomeItemCard } from './_components/HomeItemCard';
import { CategoryGrid } from './_components/CategoryGrid';
import { HomeEmptyState, HomeErrorState, HomeSkeleton } from './_components/HomeStates';
import { resolveBranding } from '../_components/branding';
import { CustomerBottomNav } from '../_components/CustomerBottomNav';
import { FeaturedHeroCard } from '../_components/FeaturedHeroCard';
import { GroupOrderBanner } from '../_components/GroupOrderBanner';
import { PageTransition } from '../_components/PageTransition';

// Day 14, Part 1 — the new first stop in the customer funnel:
// QR → Restaurant Home → Menu/Categories → Item → Cart.
//
// No fake data anywhere on this page. Every section is built from
// menuApi.getPublicMenu() (Day 9) and ordersApi.getPopular() (Day 14,
// backed by real Order history — see OrdersService.getPopularItems());
// a section with nothing real to show is hidden rather than padded out.
export default function CustomerHomePage() {
  const params = useParams<{ restaurantId: string }>();
  const searchParams = useSearchParams();
  const restaurantId = params.restaurantId;
  const tableNumber = searchParams.get('table');
  const tableId = searchParams.get('tableId');

  const contextQuery = useMemo(() => {
    const qs = new URLSearchParams();
    if (tableNumber) qs.set('table', tableNumber);
    if (tableId) qs.set('tableId', tableId);
    const str = qs.toString();
    return str ? `?${str}` : '';
  }, [tableNumber, tableId]);

  const [menu, setMenu] = useState<PublicMenu | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  // Popular is treated as a soft-fail enhancement, not core content: if
  // this call fails (or the restaurant simply has no orders yet), the
  // Home page still works — it just doesn't show a Popular section.
  const [popularItems, setPopularItems] = useState<PopularItemRecord[]>([]);

  const { items: cartItems, addItem, setQuantity, count, subtotal } = useCart(restaurantId);
  const quantityFor = (itemId: string) => cartItems.find((i) => i.itemId === itemId)?.quantity ?? 0;

  useEffect(() => {
    setMenu(null);
    setMenuError(null);
    menuApi
      .getPublicMenu(restaurantId)
      .then(setMenu)
      .catch((err) => setMenuError(err instanceof Error ? err.message : 'Failed to load restaurant.'));
    ordersApi
      .getPopular(restaurantId)
      .then(setPopularItems)
      .catch(() => setPopularItems([]));
  }, [restaurantId, loadKey]);

  const menuHref = `/menu/${restaurantId}${contextQuery}`;
  const cartHref = `/menu/${restaurantId}/cart${contextQuery}`;
  const itemHref = (itemId: string) => `/menu/${restaurantId}/${itemId}${contextQuery}`;
  const categoryHref = (categoryId: string) => `${menuHref}#category-${categoryId}`;

  // Day 22 — Featured is now genuinely admin-controlled (`isFeatured`
  // on MenuItem). Days 14/21 stood in "first item of each category by
  // sortOrder" because no such field existed; that placeholder is gone.
  // If no admin has featured anything, this is empty and the entire
  // Featured area (hero + rail) is hidden rather than backfilled.
  // Category order is preserved from the API (`sortOrder`) — never
  // re-sorted alphabetically or randomly.
  const featuredItems = useMemo(() => {
    if (!menu) return [];
    return menu.categories.flatMap((c) => c.items).filter((item) => item.isFeatured).slice(0, 8);
  }, [menu]);

  // Day 22 (Part 7) — deterministic visibility hierarchy:
  //   1. Admin Featured  2. Popular (real order data)  3. New  4. Normal
  // Each item gets AT MOST ONE badge, resolved by that priority, so a
  // dish that is both featured and popular shows only the stronger
  // signal. This is what keeps the menu feeling curated instead of
  // plastered in badges — it's a simple transparent rule, not scoring.
  const popularIds = useMemo(() => new Set(popularItems.map((i) => i.id)), [popularItems]);
  const featuredIds = useMemo(() => new Set(featuredItems.map((i) => i.id)), [featuredItems]);

  // Popular items that are ALSO featured are dropped from the Popular
  // rail — they're already shown above with a stronger treatment, and
  // repeating them makes Home look padded. Discovery, not duplication.
  const popularForDisplay = useMemo(
    () => popularItems.filter((i) => !featuredIds.has(i.id)),
    [popularItems, featuredIds],
  );

  // New Arrivals: real `createdAt` timestamps (Day 14 addition to the
  // public menu response), sorted newest-first — never a fabricated
  // date or badge.
  const newArrivals = useMemo(() => {
    if (!menu) return [];
    return menu.categories
      .flatMap((c) => c.items)
      // Same anti-duplication rule as Popular above: an item already
      // surfaced as Featured or Popular isn't repeated a third time.
      .filter((i) => !featuredIds.has(i.id) && !popularIds.has(i.id))
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }, [menu, featuredIds, popularIds]);

  const categoriesForGrid = useMemo(
    () => menu?.categories.map((c) => ({ id: c.id, name: c.name, itemCount: c.items.length })) ?? [],
    [menu],
  );

  // Real, computed stat — not fabricated copy — for the Home header's
  // "restaurant information" line (this task's Part: Customer Home).
  const totalItemCount = useMemo(() => menu?.categories.reduce((sum, c) => sum + c.items.length, 0) ?? 0, [menu]);

  if (menuError) {
    return <HomeErrorState message={menuError} onRetry={() => setLoadKey((k) => k + 1)} />;
  }

  if (!menu) {
    return <HomeSkeleton />;
  }

  const branding = resolveBranding(menu.branding);
  const isMenuEmpty = menu.categories.length === 0;
  const heroItem = featuredItems[0] ?? null;
  const railFeatured = featuredItems.slice(1);
  const searchHref = `/menu/${restaurantId}${contextQuery ? `${contextQuery}&` : '?'}openSearch=1`;

  return (
    <div className="mnu-customer min-h-screen">
      <HomeHeader
        restaurantName={menu.restaurantName}
        branding={branding}
        tableNumber={tableNumber}
        cartHref={cartHref}
        cartCount={count}
        categoryCount={menu.categories.length}
        itemCount={totalItemCount}
        searchHref={searchHref}
      />

      <main className={`mx-auto max-w-5xl space-y-6 py-4 ${count > 0 ? 'pb-48' : 'pb-32'}`}>
        {isMenuEmpty ? (
          <HomeEmptyState />
        ) : (
          <PageTransition className="space-y-6">
            {/* Group ordering entry point — placed above the menu
                sections because deciding "are we ordering together?" is
                a decision made on arrival, before browsing. */}
            <div className="px-4">
              <GroupOrderBanner restaurantId={restaurantId} contextQuery={contextQuery} />
            </div>

            {/* VARIANT B — one hero item, then the rest as a rail.
                `heroItem` is simply the first of the same real
                `featuredItems` list; nothing new is fabricated. */}
            {heroItem && (
              <div className="px-4">
                <FeaturedHeroCard
                  item={heroItem}
                  href={itemHref(heroItem.id)}
                  onAdd={() =>
                    addItem({ itemId: heroItem.id, name: heroItem.name, price: heroItem.price }, 1)
                  }
                />
              </div>
            )}

            {railFeatured.length > 0 && (
              <HomeSection title="Featured" subtitle="Chosen by the kitchen">
                {railFeatured.map((item, i) => {
                  const qty = quantityFor(item.id);
                  return (
                    <HomeItemCard
                      key={item.id}
                      item={item}
                      href={itemHref(item.id)}
                      quantity={qty}
                      animationDelayMs={i * 60}
                      onAdd={() => addItem({ itemId: item.id, name: item.name, price: item.price }, 1)}
                      onIncrease={() => setQuantity(item.id, qty + 1)}
                      onDecrease={() => setQuantity(item.id, qty - 1)}
                    />
                  );
                })}
              </HomeSection>
            )}

            {newArrivals.length > 0 && (
              <HomeSection title="New Arrivals" subtitle="Recently added to the menu">
                {newArrivals.map((item, i) => {
                  const qty = quantityFor(item.id);
                  return (
                    <HomeItemCard
                      key={item.id}
                      item={item}
                      href={itemHref(item.id)}
                      quantity={qty}
                      badge="New"
                      animationDelayMs={i * 60}
                      onAdd={() => addItem({ itemId: item.id, name: item.name, price: item.price }, 1)}
                      onIncrease={() => setQuantity(item.id, qty + 1)}
                      onDecrease={() => setQuantity(item.id, qty - 1)}
                    />
                  );
                })}
              </HomeSection>
            )}

            {/* Popular: real order history only (Day 12 Order data via
                OrdersService.getPopularItems()) — this section simply
                doesn't render for a restaurant with no orders yet,
                rather than showing fabricated popularity. */}
            {popularForDisplay.length > 0 && (
              <HomeSection title="Most ordered" subtitle="Loved by other diners">
                {popularForDisplay.map((item, i) => {
                  const qty = quantityFor(item.id);
                  return (
                    <HomeItemCard
                      key={item.id}
                      item={item}
                      href={itemHref(item.id)}
                      quantity={qty}
                      badge="Popular"
                      animationDelayMs={i * 60}
                      onAdd={() => addItem({ itemId: item.id, name: item.name, price: item.price }, 1)}
                      onIncrease={() => setQuantity(item.id, qty + 1)}
                      onDecrease={() => setQuantity(item.id, qty - 1)}
                    />
                  );
                })}
              </HomeSection>
            )}

            <CategoryGrid categories={categoriesForGrid} hrefFor={categoryHref} />

            <div className="px-4">
              <Link
                href={menuHref}
                className="block w-full rounded-hero bg-night px-4 py-4 text-center text-sm font-bold text-white shadow-soft transition active:scale-[0.99]"
              >
                View Full Menu →
              </Link>
            </div>
          </PageTransition>
        )}
      </main>

      <CustomerBottomNav
        homeHref={`/menu/${restaurantId}/home${contextQuery}`}
        menuHref={menuHref}
        searchHref={`/menu/${restaurantId}${contextQuery ? `${contextQuery}&` : '?'}openSearch=1`}
        cartHref={cartHref}
        active="home"
        cartCount={count}
        cartSubtotal={subtotal}
      />
    </div>
  );
}
