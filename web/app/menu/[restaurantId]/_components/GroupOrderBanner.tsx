'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getActiveGroupCode } from '@/lib/groupOrder';

// The customer-side entry point into group ordering, shown on Home and
// Cart. Two states, decided by whether this browser already has a group
// for this restaurant:
//   - not in a group → an invitation to start/join one
//   - already in one → a shortcut straight back to that lobby
//
// Read client-side in an effect (not during render) because
// localStorage doesn't exist during SSR — rendering the "not in a
// group" copy on the server and swapping it after hydration would
// flash the wrong state, so it renders nothing until it knows.
export function GroupOrderBanner({
  restaurantId,
  contextQuery,
}: {
  restaurantId: string;
  contextQuery: string;
}) {
  const [groupCode, setGroupCode] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setGroupCode(getActiveGroupCode(restaurantId));
    setReady(true);
  }, [restaurantId]);

  if (!ready) return null;

  if (groupCode) {
    return (
      <Link
        href={`/menu/${restaurantId}/group/${groupCode}${contextQuery}`}
        className="flex items-center gap-3 rounded-card border border-terracotta-100 bg-terracotta-50 p-4 transition active:scale-[0.99]"
      >
        <span className="text-xl" aria-hidden="true">👥</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-carbon-900">You&apos;re in a group order</span>
          <span className="block text-xs text-carbon-400">
            Code {groupCode} · tap to see the group cart
          </span>
        </span>
        <span className="shrink-0 text-sm font-bold text-terracotta-600" aria-hidden="true">→</span>
      </Link>
    );
  }

  return (
    <Link
      href={`/menu/${restaurantId}/group${contextQuery}`}
      className="flex items-center gap-3 rounded-card border border-hairline bg-surface p-4 transition active:scale-[0.99]"
    >
      <span className="text-xl" aria-hidden="true">👥</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-carbon-900">Order as a group</span>
        <span className="block text-xs text-carbon-400">
          Everyone at the table orders from their own phone
        </span>
      </span>
      <span className="shrink-0 text-sm font-bold text-terracotta-600" aria-hidden="true">→</span>
    </Link>
  );
}
