import type { DashboardTrendPoint } from '@/lib/api';

// No charting library exists in this project's dependencies (checked
// package.json) — a 7-point bar chart doesn't need one. Plain divs,
// heights computed against the window's own max, so it stays legible
// whether the busiest day sold ₹500 or ₹50,000.
export function TrendChart({ trend }: { trend: DashboardTrendPoint[] }) {
  const maxSales = Math.max(1, ...trend.map((d) => d.sales));

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4">
      <p className="mb-3 text-xs font-semibold text-ink-400">Sales, last 7 days</p>
      <div className="flex h-32 items-end gap-2">
        {trend.map((point) => {
          const heightPct = Math.max(4, Math.round((point.sales / maxSales) * 100));
          const dayLabel = new Date(`${point.date}T00:00:00Z`).toLocaleDateString(undefined, {
            weekday: 'short',
            timeZone: 'UTC',
          });
          return (
            <div key={point.date} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-full w-full items-end" title={`₹${point.sales} · ${point.orders} orders`}>
                <div
                  className="w-full rounded-t-md bg-brand-500/80"
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className="text-[10px] font-medium text-ink-400">{dayLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
