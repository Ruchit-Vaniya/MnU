'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ordersApi, ORDER_STATUS_TRANSITIONS, type AdminOrderRecord, type OrderStatus } from '@/lib/api';
import { useRestaurantContext } from '../../restaurant-context';
import { StatusBadge } from '../_components/StatusBadge';

const STATUS_LABEL: Record<OrderStatus, string> = {
  NEW: 'New',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  READY: 'Ready',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export default function OrderDetailPage() {
  useRestaurantContext();
  const params = useParams<{ restaurantId: string; orderId: string }>();
  const { restaurantId, orderId } = params;

  const [order, setOrder] = useState<AdminOrderRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<OrderStatus | null>(null);

  useEffect(() => {
    ordersApi
      .get(restaurantId, orderId)
      .then(setOrder)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load order.'));
  }, [restaurantId, orderId]);

  // Part 2: writes the new status to MongoDB via PATCH, then updates
  // this screen from the *server's* response — not by just optimistically
  // setting local state — so what's shown here is always what's actually
  // persisted. Refresh/logout-login/reopen all read the same way, via
  // ordersApi.get()/list(), so the status can never drift back to a
  // stale value.
  const changeStatus = async (next: OrderStatus) => {
    setError(null);
    setUpdating(next);
    try {
      const updated = await ordersApi.updateStatus(restaurantId, orderId, next);
      setOrder(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status.');
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/restaurants/${restaurantId}/orders`} className="text-xs font-semibold text-ink-400">
        ← Orders
      </Link>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {!order && !error && <p className="mt-6 text-sm text-ink-400">Loading order...</p>}

      {order && (
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-ink-900">{order.orderNumber}</h2>
              {/* One order per group — this badge exists so staff know a
                  single ticket covers several diners at the table. */}
              {order.groupCode && (
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-600">
                  👥 Group {order.groupCode}
                </span>
              )}
            </div>
            <StatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-sm text-ink-400">
            Table {order.tableNumber} ·{' '}
            {new Date(order.createdAt).toLocaleString([], {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
          {order.customer && (
            <p className="mt-1 text-xs text-ink-400">
              Customer {order.customer.customerCode}
              {order.customer.name ? ` · ${order.customer.name}` : ''}
              {order.customer.mobileNumber ? ` · ${order.customer.mobileNumber}` : ''}
              {order.customer.email ? ` · ${order.customer.email}` : ''}
            </p>
          )}

          {/* Part 2: the actual status-change control — only the
              transitions OrdersService.updateStatus will accept are
              offered as buttons, so there's no click that can produce a
              rejected request in normal use. */}
          {ORDER_STATUS_TRANSITIONS[order.status].length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {ORDER_STATUS_TRANSITIONS[order.status].map((next) => (
                <button
                  key={next}
                  onClick={() => changeStatus(next)}
                  disabled={updating !== null}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                    next === 'CANCELLED'
                      ? 'border border-red-200 text-red-600'
                      : 'bg-brand-500 text-white'
                  }`}
                >
                  {updating === next ? 'Saving...' : `Mark as ${STATUS_LABEL[next]}`}
                </button>
              ))}
            </div>
          )}
          {ORDER_STATUS_TRANSITIONS[order.status].length === 0 && (
            <p className="mt-4 text-xs text-ink-400">This order is in a final state and can&apos;t be changed further.</p>
          )}

          <div className="mt-5 divide-y divide-ink-100 rounded-2xl border border-ink-100 bg-white">
            {order.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-ink-900">{item.name}</p>
                  <p className="text-xs text-ink-400">
                    ₹{item.price} × {item.quantity}
                    {/* Only present on group orders — keeps a combined
                        ticket actionable by telling staff whose dish is
                        whose. */}
                    {item.addedByName ? ` · for ${item.addedByName}` : ''}
                  </p>
                </div>
                <p className="font-semibold text-ink-900">₹{item.lineTotal}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-1.5 rounded-2xl border border-ink-100 bg-white p-4 text-sm">
            <div className="flex justify-between text-ink-400">
              <span>Subtotal</span>
              <span>₹{order.subtotal}</span>
            </div>
            <div className="flex justify-between border-t border-ink-100 pt-1.5 text-base font-bold text-ink-900">
              <span>Total</span>
              <span>₹{order.total}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
