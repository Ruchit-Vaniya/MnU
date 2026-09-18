'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { customersApi, type CustomerHistoryResponse } from '@/lib/api';
import { useRestaurantContext } from '../../restaurant-context';
import { StatusBadge } from '../../orders/_components/StatusBadge';

// GET /restaurants/:id/customers/:customerId/orders — reuses
// OrdersService.listCustomerOrdersForRestaurant (already existed as of
// Day 17, extended this task to also return the customer's own profile
// fields). Backend enforces restaurantId+customerId together and only
// resolves the customer profile once at least one matching order
// exists — see that method's own security comment — so this page can
// never render another restaurant's customer, even given a valid
// customerId for one.
export default function CustomerHistoryPage() {
  useRestaurantContext();
  const params = useParams<{ restaurantId: string; customerId: string }>();
  const { restaurantId, customerId } = params;

  const [data, setData] = useState<CustomerHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);

  useEffect(() => {
    setData(null);
    setError(null);
    customersApi
      .getHistory(restaurantId, customerId)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load this customer.'));
  }, [restaurantId, customerId, loadKey]);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/restaurants/${restaurantId}/customers`} className="text-xs font-semibold text-ink-400">
        ← Customers
      </Link>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          <p>{error}</p>
          <button onClick={() => setLoadKey((k) => k + 1)} className="mt-1 text-xs font-semibold underline">
            Try again
          </button>
        </div>
      )}

      {!data && !error && <p className="mt-6 text-sm text-ink-400">Loading customer...</p>}

      {/* Not-found / unauthorized: a valid-looking customerId that has
          never ordered at this restaurant, or doesn't exist at all, both
          come back from the backend the same way — `customer: null`,
          `orders: []` — same "looks like 404" isolation principle used
          everywhere else in this project. */}
      {data && !data.customer && (
        <div className="mt-6 rounded-2xl border border-dashed border-ink-200 bg-white p-8 text-center">
          <p className="text-3xl">🔍</p>
          <p className="mt-3 text-sm font-semibold text-ink-900">Customer not found</p>
          <p className="mt-1 text-xs text-ink-400">
            This customer hasn&apos;t ordered from this restaurant, or the link is invalid.
          </p>
        </div>
      )}

      {data && data.customer && (
        <div className="mt-4">
          <h2 className="text-xl font-bold text-ink-900">{data.customer.name || data.customer.customerCode}</h2>
          <p className="mt-1 text-xs text-ink-400">
            {[data.customer.customerCode, data.customer.mobileNumber, data.customer.email]
              .filter(Boolean)
              .join(' · ')}
          </p>

          <p className="mt-5 text-sm font-semibold text-ink-700">
            {data.orders.length} order{data.orders.length !== 1 ? 's' : ''} at this restaurant
          </p>

          {data.orders.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-dashed border-ink-200 bg-white p-8 text-center">
              <p className="text-sm text-ink-400">No orders to show.</p>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {data.orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/restaurants/${restaurantId}/orders/${order.id}`}
                  className="block rounded-2xl border border-ink-100 bg-white p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-ink-900">{order.orderNumber}</p>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="mt-1 text-xs text-ink-400">
                    Table {order.tableNumber} · {order.items.length} item{order.items.length !== 1 ? 's' : ''} ·{' '}
                    {new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </p>
                  <p className="mt-2 font-bold text-ink-900">₹{order.total}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
