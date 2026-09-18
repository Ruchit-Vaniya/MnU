'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { tableSessionApi, type TableSessionResponse } from '@/lib/api';

// Entry point for the customer-facing flow: /scan/[restaurantId]/[tableId].
// No login, no cart, no order — just "which restaurant, which table, is
// there a session." QR code generation itself is a separate, later task;
// today this URL shape (restaurantId + tableId) *is* the "QR identifier"
// — a real QR code would just encode this same URL once one exists, so
// nothing here needs to change when that's built.
export default function TableScanPage() {
  const params = useParams<{ restaurantId: string; tableId: string }>();
  const [data, setData] = useState<TableSessionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    tableSessionApi
      .start(params.restaurantId, params.tableId)
      .then(setData)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'This table could not be found.'),
      );
  }, [params.restaurantId, params.tableId]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-ink-100 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-red-600">{error}</p>
          <p className="mt-2 text-xs text-ink-400">
            Check the QR code or link and try again.
          </p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-ink-400">Loading your table...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-ink-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500 text-xl text-white">
          🍴
        </div>
        <h1 className="text-xl font-bold text-ink-900">{data.restaurant.name}</h1>
        <p className="mt-1 text-sm text-ink-400">Table {data.table.tableNumber}</p>

        <span
          className={`mt-4 inline-block rounded-full px-3 py-1 text-xs font-semibold ${
            data.session.status === 'ACTIVE'
              ? 'bg-green-50 text-green-600'
              : 'bg-ink-100 text-ink-400'
          }`}
        >
          Session {data.session.status === 'ACTIVE' ? 'active' : 'ended'}
        </span>

        {/* Day 9: the real, restaurant-scoped customer menu exists at
            /menu/[restaurantId] — this used to point at the dummy
            /menu/demo page (see docs/PROGRESS.md, Day 8's "next task").
            Day 10: pass the table number along so pages can show
            "Table X" subtly. Day 12: also pass the table's real
            database id — placing an order needs it (tableNumber alone
            is just display text, not something the backend can look up
            a table or session by).
            Day 14: the QR flow now lands on the new customer Home page
            first (QR → Home → Menu → Item → Cart), not straight into
            the full menu list — see /menu/[restaurantId]/home. */}
        <Link
          href={`/menu/${data.restaurant.id}/home?table=${encodeURIComponent(data.table.tableNumber)}&tableId=${data.table.id}`}
          className="mt-6 block w-full rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white"
        >
          View Menu
        </Link>
      </div>
    </main>
  );
}
