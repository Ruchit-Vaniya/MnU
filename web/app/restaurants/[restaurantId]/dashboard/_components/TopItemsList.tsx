import type { DashboardTopItem } from '@/lib/api';

export function TopItemsList({ items }: { items: DashboardTopItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-200 bg-white p-6 text-center">
        <p className="text-sm text-ink-400">No orders yet — top-selling items will show up here.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-2">
      {items.map((item, i) => (
        <div
          key={item.name}
          className={`flex items-center gap-3 px-3 py-2.5 ${i !== items.length - 1 ? 'border-b border-ink-100' : ''}`}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cream-100 text-xs font-bold text-ink-700">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink-900">{item.name}</p>
            <p className="text-xs text-ink-400">{item.quantity} sold</p>
          </div>
          <p className="shrink-0 text-sm font-bold text-ink-900">₹{item.revenue}</p>
        </div>
      ))}
    </div>
  );
}
