'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { menuApi, ordersApi, type PublicMenu } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { MenuHeader } from './_components/MenuHeader';
import { CategoryTabs } from './_components/CategoryTabs';
import { MenuItemCard } from './_components/MenuItemCard';
import { CustomerBottomNav } from './_components/CustomerBottomNav';
import { PageTransition } from './_components/PageTransition';
import { EmptyMenuState, EmptySearchState, MenuErrorState, MenuSkeleton } from './_components/MenuStates';

// Day 13: UI/UX redesign of the customer QR menu. No new backend
// endpoints or schema fields — same menuApi.getPublicMenu() call Day 9
// introduced, same cart hook Day 11 introduced. Search and the
// active-category highlight are both computed client-side over the
// already-fetched menu; neither talks to the API.
export default function CustomerMenuPage() {
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
  // Day 22 — ids of order-derived popular items, used only to badge
  // cards in their normal category position. Soft-fail: an empty set
  // just means no Popular badges.
  const [popularIds, setPopularIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const [searchOpen, setSearchOpen] = useState(() => searchParams.get('openSearch') === '1');
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const { items: cartItems, addItem, setQuantity, count, subtotal } = useCart(restaurantId);
  const quantityFor = (itemId: string) => cartItems.find((i) => i.itemId === itemId)?.quantity ?? 0;

  useEffect(() => {
    setMenu(null);
    setError(null);
    menuApi
      .getPublicMenu(restaurantId)
      .then(setMenu)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load menu.'));
    // Day 22 (Part 9) — a featured/popular dish must stay in its own
    // category AND be visibly highlighted there. `isFeatured` already
    // rides along on the menu response, but popularity is order-derived,
    // so this one extra call supplies the ids to badge. Soft-fail: if it
    // errors or the restaurant has no order history, the menu renders
    // exactly as before with no Popular badges — never invented ones.
    ordersApi
      .getPopular(restaurantId)
      .then((items) => setPopularIds(new Set(items.map((i) => i.id))))
      .catch(() => setPopularIds(new Set()));
  }, [restaurantId, loadKey]);

  

  const trimmedQuery = query.trim().toLowerCase();

  // Same one-badge-max priority as Home: Featured outranks Popular.
  const badgeFor = (item: { id: string; isFeatured: boolean }) =>
    item.isFeatured ? ('featured' as const) : popularIds.has(item.id) ? ('popular' as const) : null;

  const visibleCategories = useMemo(() => {
    if (!menu) return [];
    if (!trimmedQuery) return menu.categories;
    return menu.categories
      .map((category) => ({
        ...category,
        items: category.items.filter(
          (item) =>
            item.name.toLowerCase().includes(trimmedQuery) ||
            item.description?.toLowerCase().includes(trimmedQuery),
        ),
      }))
      .filter((category) => category.items.length > 0);
  }, [menu, trimmedQuery]);

  // Scrollspy: highlights the category tab for whichever section is
  // currently most visible, so the nav stays accurate as the customer
  // scrolls, not just when they tap a tab.
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const registerSection = useCallback((id: string, el: HTMLElement | null) => {
    if (el) sectionRefs.current.set(id, el);
    else sectionRefs.current.delete(id);
  }, []);

  useEffect(() => {
    if (trimmedQuery || visibleCategories.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveCategory(visible[0].target.id.replace('category-', ''));
      },
      { rootMargin: '-120px 0px -70% 0px', threshold: 0 },
    );
    sectionRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [visibleCategories, trimmedQuery]);

  // Day 14: the new Home page links into a specific category via
  // `#category-<id>` (e.g. tapping "Starters" on Home should land
  // directly on that section of the full menu, not just the top).
  // Plain anchor scrolling can't be relied on here since the sections
  // render asynchronously after the menu fetch resolves — this re-checks
  // the hash once content is actually on the page.
  useEffect(() => {
    if (!menu || trimmedQuery) return;
    const hash = window.location.hash.replace('#category-', '');
    if (!hash) return;
    const el = sectionRefs.current.get(hash);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveCategory(hash);
    }
    // Deliberately runs once the menu (and thus its sections) exist —
    // not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, trimmedQuery]);

  const goToCategory = (id: string | null) => {
    setActiveCategory(id);
    if (id === null) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    sectionRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const cartHref = `/menu/${restaurantId}/cart${contextQuery}`;
  const homeHref = `/menu/${restaurantId}/home${contextQuery}`;
  const menuHref = `/menu/${restaurantId}${contextQuery}`;
  const searchHref = `/menu/${restaurantId}${contextQuery ? `${contextQuery}&` : '?'}openSearch=1`;

  if (error) {
    return <MenuErrorState message={error} onRetry={() => setLoadKey((k) => k + 1)} />;
  }

  if (!menu) {
    return <MenuSkeleton />;
  }

  return (
    <div className="mnu-customer min-h-screen">
      <MenuHeader
        restaurantName={menu.restaurantName}
        tableNumber={tableNumber}
        cartHref={cartHref}
        cartCount={count}
        searchOpen={searchOpen}
        searchQuery={query}
        onSearchOpenChange={setSearchOpen}
        onSearchQueryChange={setQuery}
      />

      {!trimmedQuery && (
        <CategoryTabs
          categories={menu.categories.map((c) => ({ id: c.id, name: c.name }))}
          activeId={activeCategory}
          onSelect={goToCategory}
        />
      )}

      <main className={`mx-auto max-w-5xl px-4 pt-4 ${count > 0 ? 'pb-48' : 'pb-32'}`}>
        {menu.categories.length === 0 ? (
          <EmptyMenuState />
        ) : visibleCategories.length === 0 ? (
          <EmptySearchState query={query.trim()} />
        ) : (
          <PageTransition className="space-y-7">
            {visibleCategories.map((category) => (
              <section
                key={category.id}
                id={`category-${category.id}`}
                ref={(el) => registerSection(category.id, el)}
                className="scroll-mt-[112px]"
              >
                <h2 className="mb-3 text-base font-extrabold text-carbon-900">{category.name}</h2>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
                  {category.items.map((item, i) => {
                    const qty = quantityFor(item.id);
                    return (
                      <MenuItemCard
                        key={item.id}
                        item={item}
                        href={`/menu/${restaurantId}/${item.id}${contextQuery}`}
                        badge={badgeFor(item)}
                        quantity={qty}
                        // Capped so a huge menu doesn't leave the last
                        // cards waiting a visibly long time to appear —
                        // this is a first-paint flourish, not a reason to
                        // delay usability.
                        animationDelayMs={Math.min(i, 9) * 40}
                        onAdd={() => addItem({ itemId: item.id, name: item.name, price: item.price }, 1)}
                        onIncrease={() => setQuantity(item.id, qty + 1)}
                        onDecrease={() => setQuantity(item.id, qty - 1)}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </PageTransition>
        )}
      </main>

      <CustomerBottomNav
        homeHref={homeHref}
        menuHref={menuHref}
        searchHref={searchHref}
        cartHref={cartHref}
        active={searchOpen ? 'search' : 'menu'}
        cartCount={count}
        cartSubtotal={subtotal}
      />
    </div>
  );
}
