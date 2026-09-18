import Link from 'next/link';
import { foodVisual } from '../../_components/foodVisual';

export interface CategoryGridItem {
  id: string;
  name: string;
  itemCount: number;
}

interface CategoryGridProps {
  categories: CategoryGridItem[];
  hrefFor: (categoryId: string) => string;
}

// Real categories from the public menu API only (see page.tsx — built
// directly from `menu.categories`, never hard-coded). Tapping one links
// straight to that section of the full menu (`#category-<id>`, handled
// by the menu page's scroll-to-hash effect) rather than duplicating the
// category's item list here.
export function CategoryGrid({ categories, hrefFor }: CategoryGridProps) {
  if (categories.length === 0) return null;

  return (
    <section>
      <div className="px-4">
        <h2 className="text-base font-extrabold text-carbon-900">Categories</h2>
      </div>
      {/* Horizontal scroll rail rather than a grid: it keeps Home short
          and breathable regardless of how many categories a restaurant
          has, and scrolling is contained to this row so the page itself
          never scrolls sideways. */}
      <div className="no-scrollbar mt-3 flex gap-2.5 overflow-x-auto px-4 pb-1">
        {categories.map((category) => {
          const { icon, tone } = foodVisual(category.id);
          return (
            <Link
              key={category.id}
              href={hrefFor(category.id)}
              className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-full bg-surface py-2 pl-2 pr-4 shadow-soft transition active:scale-95"
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-base ${tone}`}>
                {icon}
              </span>
              <span className="min-w-0">
                <span className="block whitespace-nowrap text-sm font-bold text-carbon-900">
                  {category.name}
                </span>
                <span className="block text-[10px] text-carbon-400">
                  {category.itemCount} item{category.itemCount === 1 ? '' : 's'}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
