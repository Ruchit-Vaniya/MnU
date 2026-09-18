'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRestaurantContext } from '../restaurant-context';

// This task: real analytics now live directly on the Dashboard (the
// task's own instruction — "visible directly on the dashboard, not
// hidden on another page"), not here. Kept as a redirect-style page
// rather than deleted outright, same reasoning Day 17 used for the old
// /dashboard "Welcome" page — an old bookmark/nav link to /analytics
// shouldn't 404, it should land somewhere useful.
export default function RestaurantAnalyticsPage() {
  useRestaurantContext();
  const params = useParams<{ restaurantId: string }>();

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-xl font-bold text-ink-900">Analytics</h2>
      <p className="mt-1 text-sm text-ink-400">
        Sales, orders, and top-item analytics now live on your Dashboard.
      </p>

      <div className="mt-6 rounded-2xl border border-dashed border-ink-200 bg-white p-8 text-center">
        <p className="text-3xl">📊</p>
        <p className="mt-3 text-sm font-semibold text-ink-900">Moved to the Dashboard</p>
        <p className="mt-1 text-xs text-ink-400">
          Today&apos;s sales, orders, average order value, active/completed orders, top-selling items, recent
          orders, and a 7-day trend are all there now.
        </p>
        <Link
          href={`/restaurants/${params.restaurantId}/dashboard`}
          className="mt-4 inline-block rounded-full bg-brand-500 px-5 py-2 text-sm font-semibold text-white"
        >
          Go to Dashboard →
        </Link>
      </div>
    </div>
  );
}
