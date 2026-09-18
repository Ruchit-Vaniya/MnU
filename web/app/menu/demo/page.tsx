'use client';

import { useMemo, useState } from 'react';
import { dummyRestaurant, dummyCategories, dummyMenuItems } from '@/lib/dummy-menu';

// Fully self-contained demo — all data is hardcoded in lib/dummy-menu.ts.
// No API calls: MnU doesn't have a menu/ordering backend yet (that's a
// later task). The cart below is local component state only, for feel.
export default function DemoMenuPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});

  const items = useMemo(
    () => dummyMenuItems.filter((item) => activeCategory === null || item.categoryId === activeCategory),
    [activeCategory],
  );

  const addToCart = (id: string) => setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }));

  const itemCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const subtotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = dummyMenuItems.find((i) => i.id === id);
    return sum + (item ? item.price * qty : 0);
  }, 0);

  return (
    <div className="mx-auto min-h-screen max-w-md bg-cream-100 pb-28">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-ink-100 bg-cream-100/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-100 text-lg">
            🍴
          </div>
          <div>
            <h1 className="text-base font-bold text-ink-900">{dummyRestaurant.name}</h1>
            <div className="flex items-center gap-1.5 text-xs">
              <span className={`h-1.5 w-1.5 rounded-full ${dummyRestaurant.isOpen ? 'bg-success-500' : 'bg-danger-500'}`} />
              <span className={dummyRestaurant.isOpen ? 'text-success-500' : 'text-danger-500'}>
                {dummyRestaurant.isOpen ? 'Open now' : 'Closed'}
              </span>
              <span className="text-ink-200">•</span>
              <span className="text-ink-400">Table {dummyRestaurant.tableNumber}</span>
            </div>
          </div>
        </div>
        <p className="mt-2 rounded-lg bg-brand-50 px-3 py-1.5 text-[11px] text-brand-600">
          Demo menu — dummy data only, not connected to a live restaurant.
        </p>
      </div>

      {/* Category pills */}
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-4">
        <button
          onClick={() => setActiveCategory(null)}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
            activeCategory === null ? 'bg-ink-900 text-white' : 'border border-ink-200 bg-white text-ink-600'
          }`}
        >
          All
        </button>
        {dummyCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
              activeCategory === cat.id ? 'bg-ink-900 text-white' : 'border border-ink-200 bg-white text-ink-600'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Items */}
      <div className="mt-3 space-y-3 px-4">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-ink-100 text-2xl">
              🍽️
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={`flex h-3.5 w-3.5 items-center justify-center rounded-sm border ${
                    item.isVeg ? 'border-success-500' : 'border-danger-500'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${item.isVeg ? 'bg-success-500' : 'bg-danger-500'}`} />
                </span>
                <h3 className="truncate text-sm font-semibold text-ink-900">{item.name}</h3>
              </div>
              <p className="mt-0.5 line-clamp-1 text-xs text-ink-400">{item.description}</p>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-sm font-bold text-ink-900">₹{item.price}</span>
                <button
                  onClick={() => addToCart(item.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white active:scale-95"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sticky cart */}
      {itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md px-4 pb-4">
          <div className="flex items-center justify-between rounded-2xl bg-ink-900 px-5 py-4 text-white shadow-xl">
            <span className="text-sm font-semibold">
              {itemCount} {itemCount === 1 ? 'Item' : 'Items'} • ₹{subtotal}
            </span>
            <span className="text-sm font-bold text-brand-400">Demo only — no checkout</span>
          </div>
        </div>
      )}
    </div>
  );
}
