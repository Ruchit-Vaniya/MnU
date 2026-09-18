'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ordersApi, ACTIVE_ORDER_STATUSES, type AdminOrderRecord, type OrderStatus } from '@/lib/api';
import { useRestaurantContext } from '../restaurant-context';
import { StatusBadge } from './_components/StatusBadge';

type Filter = 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'ALL';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ACTIVE', label: 'Active' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
  { key: 'ALL', label: 'All' },
];

function matchesFilter(status: OrderStatus, filter: Filter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'ACTIVE') return (ACTIVE_ORDER_STATUSES as OrderStatus[]).includes(status);
  return status === filter;
}

// Part 2 (this task): status now comes straight from MongoDB via
// ordersApi.list() — this page never hard-codes "New" anywhere, it just
// renders whatever `order.status` actually is. The Active/Completed/
// Cancelled split below is the "dashboard should distinguish" part of
// the task; it's a client-side filter over the same list, not a new
// endpoint (the whole list is small enough for that to be reasonable).
export default function RestaurantOrdersPage() {
  useRestaurantContext();
  const params = useParams<{ restaurantId: string }>();
  const restaurantId = params.restaurantId;

  const [orders, setOrders] = useState<AdminOrderRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ACTIVE');

  useEffect(() => {
    ordersApi
      .list(restaurantId)
      .then(setOrders)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load orders.'));
  }, [restaurantId]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { ACTIVE: 0, COMPLETED: 0, CANCELLED: 0, ALL: orders?.length ?? 0 };
    for (const o of orders ?? []) {
      if ((ACTIVE_ORDER_STATUSES as OrderStatus[]).includes(o.status)) c.ACTIVE += 1;
      else if (o.status === 'COMPLETED') c.COMPLETED += 1;
      else if (o.status === 'CANCELLED') c.CANCELLED += 1;
    }
    return c;
  }, [orders]);

  const filtered = (orders ?? []).filter((o) => matchesFilter(o.status, filter));

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-xl font-bold text-ink-900">Orders</h2>
      <p className="mt-1 text-sm text-ink-400">Live and recent orders from customer tables.</p>

      <div className="mt-4 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              filter === f.key ? 'bg-brand-500 text-white' : 'bg-white text-ink-700 border border-ink-100'
            }`}
          >
            {f.label} ({counts[f.key]})
          </button>
        ))}
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {!orders && !error && <p className="mt-6 text-sm text-ink-400">Loading orders...</p>}

      {orders && filtered.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-ink-200 bg-white p-8 text-center">
          <p className="text-3xl">🧾</p>
          <p className="mt-3 text-sm font-semibold text-ink-900">No {filter === 'ALL' ? '' : filter.toLowerCase()} orders</p>
          <p className="mt-1 text-xs text-ink-400">
            {filter === 'ACTIVE'
              ? 'Orders placed from a customer\u2019s table will show up here.'
              : 'Nothing in this view yet.'}
          </p>
        </div>
      )}

      {orders && filtered.length > 0 && (
        <div className="mt-4 space-y-3">
          {filtered.map((order) => (
            <Link
              key={order.id}
              href={`/restaurants/${restaurantId}/orders/${order.id}`}
              className="block rounded-2xl border border-ink-100 bg-white p-4"
            >
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 font-semibold text-ink-900">
                  {order.orderNumber}
                  {order.groupCode && (
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-600">
                      👥 Group
                    </span>
                  )}
                </p>
                <StatusBadge status={order.status} />
              </div>
              <p className="mt-1 text-xs text-ink-400">
                Table {order.tableNumber} · {order.items.length} item{order.items.length !== 1 ? 's' : ''} ·{' '}
                {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="mt-2 font-bold text-ink-900">₹{order.total}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
