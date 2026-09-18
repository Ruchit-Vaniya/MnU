'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { customersApi, type RestaurantCustomerRecord } from '@/lib/api';
import { useRestaurantContext } from '../restaurant-context';

// Read-only, restaurant-scoped. `customersApi.list()` hits
// GET /restaurants/:id/customers, which OrdersService derives entirely
// from this restaurant's own Order documents (see that method's own
// comment) — never a global customer list filtered client-side, and
// never mock data.
export default function RestaurantCustomersPage() {
  useRestaurantContext();
  const params = useParams<{ restaurantId: string }>();
  const restaurantId = params.restaurantId;

  const [customers, setCustomers] = useState<RestaurantCustomerRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);

  useEffect(() => {
    setCustomers(null);
    setError(null);
    customersApi
      .list(restaurantId)
      .then(setCustomers)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load customers.'));
  }, [restaurantId, loadKey]);

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-xl font-bold text-ink-900">Customers</h2>
      <p className="mt-1 text-sm text-ink-400">Customers who have ordered from this restaurant.</p>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          <p>{error}</p>
          <button onClick={() => setLoadKey((k) => k + 1)} className="mt-1 text-xs font-semibold underline">
            Try again
          </button>
        </div>
      )}

      {!customers && !error && <p className="mt-6 text-sm text-ink-400">Loading customers...</p>}

      {customers && customers.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-ink-200 bg-white p-8 text-center">
          <p className="text-3xl">👥</p>
          <p className="mt-3 text-sm font-semibold text-ink-900">No customers yet</p>
          <p className="mt-1 text-xs text-ink-400">
            Once someone places an order from a table at this restaurant, they&apos;ll show up here.
          </p>
        </div>
      )}

      {customers && customers.length > 0 && (
        <div className="mt-4 space-y-3">
          {customers.map((customer) => (
            <Link
              key={customer.id}
              href={`/restaurants/${restaurantId}/customers/${customer.id}`}
              className="block rounded-2xl border border-ink-100 bg-white p-4"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-ink-900">
                  {customer.name || customer.customerCode || 'Customer'}
                </p>
                <p className="text-sm font-bold text-ink-900">₹{customer.totalSpent}</p>
              </div>
              <p className="mt-1 text-xs text-ink-400">
                {[customer.customerCode, customer.mobileNumber, customer.email].filter(Boolean).join(' · ')}
              </p>
              <p className="mt-2 text-xs text-ink-400">
                {customer.orderCount} order{customer.orderCount !== 1 ? 's' : ''} · Last order{' '}
                {new Date(customer.lastOrderAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
