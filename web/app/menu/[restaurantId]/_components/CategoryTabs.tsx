'use client';

import { useEffect, useRef } from 'react';

export interface CategoryTabItem {
  id: string;
  name: string;
}

interface CategoryTabsProps {
  categories: CategoryTabItem[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
}

// Categories are always the restaurant's real categories from the public
// menu API — never hard-coded (see menu/page.tsx, which builds this list
// from the fetched response). "All" (id null) clears the active section
// and scrolls to the top of the list.
export function CategoryTabs({ categories, activeId, onSelect }: CategoryTabsProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // Day 23 (Part 6) — "category selection should feel immediate": the
  // active tab now keeps itself scrolled into view within its own rail,
  // whether the change came from a tap OR from scrollspy as the diner
  // scrolls the menu — a restaurant with many categories previously had
  // to be scrolled through the rail by hand to find the highlighted one.
  useEffect(() => {
    const key = activeId ?? '__all__';
    const el = tabRefs.current.get(key);
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeId]);

  if (categories.length === 0) return null;

  return (
    <nav
      aria-label="Menu categories"
      className="sticky top-[57px] z-10 border-b border-hairline bg-canvas/95 backdrop-blur"
    >
      <div ref={railRef} className="no-scrollbar mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 py-2.5">
        <TabButton
          label="All"
          active={activeId === null}
          onClick={() => onSelect(null)}
          registerRef={(el) => {
            if (el) tabRefs.current.set('__all__', el);
          }}
        />
        {categories.map((category) => (
          <TabButton
            key={category.id}
            label={category.name}
            active={activeId === category.id}
            onClick={() => onSelect(category.id)}
            registerRef={(el) => {
              if (el) tabRefs.current.set(category.id, el);
            }}
          />
        ))}
      </div>
    </nav>
  );
}

function TabButton({
  label,
  active,
  onClick,
  registerRef,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  registerRef: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      ref={registerRef}
      type="button"
      onClick={onClick}
      className={`min-h-[38px] shrink-0 rounded-full px-4 text-sm font-bold transition-all duration-200 active:scale-90 ${
        active
          ? 'scale-105 bg-night text-white shadow-soft'
          : 'bg-surface text-carbon-700 shadow-soft active:bg-canvas-deep'
      }`}
    >
      {label}
    </button>
  );
}
