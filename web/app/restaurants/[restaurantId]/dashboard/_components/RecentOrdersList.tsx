import Link from 'next/link';
import type { AdminOrderRecord } from '@/lib/api';
import { StatusBadge } from '../../orders/_components/StatusBadge';

export function RecentOrdersList({
  restaurantId,
  orders,
}: {
  restaurantId: string;
  orders: AdminOrderRecord[];
}) {
  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-200 bg-white p-6 text-center">
        <p className="text-sm text-ink-400">No orders placed yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-2">
      {orders.map((order, i) => (
        <Link
          key={order.id}
          href={`/restaurants/${restaurantId}/orders/${order.id}`}
          className={`flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-cream-100 ${
            i !== orders.length - 1 ? 'border-b border-ink-100' : ''
          }`}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-900">
              {order.orderNumber} <span className="font-normal text-ink-400">· Table {order.tableNumber}</span>
            </p>
            <p className="text-xs text-ink-400">
              {new Date(order.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <p className="text-sm font-bold text-ink-900">₹{order.total}</p>
            <StatusBadge status={order.status} />
          </div>
        </Link>
      ))}
    </div>
  );
}
