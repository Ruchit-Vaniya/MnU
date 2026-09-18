import type { OrderStatus } from '@/lib/api';

const STYLES: Record<OrderStatus, string> = {
  NEW: 'bg-brand-50 text-brand-600',
  CONFIRMED: 'bg-blue-50 text-blue-600',
  PREPARING: 'bg-amber-50 text-amber-700',
  READY: 'bg-purple-50 text-purple-600',
  COMPLETED: 'bg-green-50 text-green-600',
  CANCELLED: 'bg-red-50 text-red-600',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[status]}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
