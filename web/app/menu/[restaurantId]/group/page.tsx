'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { groupOrdersApi } from '@/lib/api';
import { hasCustomerToken } from '@/lib/customerAuth';
import { getActiveGroupCode, setActiveGroupCode } from '@/lib/groupOrder';
import { GroupShell } from './_components/GroupShell';
import { CustomerAuthPanel } from '../_components/CustomerAuthPanel';

// Group ordering entry point: Create or Join.
//
// Auth is required here (unlike browsing) because a group lobby lists
// its members by name — "who are you" has to be answerable before you
// can appear in someone else's list. Reuses the existing
// CustomerAuthPanel inline, exactly as the Review page does, rather
// than bouncing to a separate login route that would lose the
// table/cart context.
export default function GroupEntryPage() {
  const params = useParams<{ restaurantId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { restaurantId } = params;

  const tableNumber = searchParams.get('table');
  const tableId = searchParams.get('tableId');
  const contextQuery = (() => {
    const qs = new URLSearchParams();
    if (tableNumber) qs.set('table', tableNumber);
    if (tableId) qs.set('tableId', tableId);
    const str = qs.toString();
    return str ? `?${str}` : '';
  })();

  const [authed, setAuthed] = useState(false);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAuthed(hasCustomerToken());
    setCheckedAuth(true);

    // Already in a group for this restaurant? Go straight to the lobby
    // rather than making them re-create/re-join something they're
    // already part of.
    const existing = getActiveGroupCode(restaurantId);
    if (existing) {
      router.replace(`/menu/${restaurantId}/group/${existing}${contextQuery}`);
    }
    // contextQuery/router are stable enough here; this is a mount-time
    // redirect check, not a subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const handleCreate = async () => {
    if (!tableId) {
      setError('Scan the table QR code to start a group order.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const group = await groupOrdersApi.create(restaurantId, tableId);
      setActiveGroupCode(restaurantId, group.groupCode);
      router.push(`/menu/${restaurantId}/group/${group.groupCode}${contextQuery}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the group.');
      setCreating(false);
    }
  };

  const backHref = `/menu/${restaurantId}/home${contextQuery}`;

  return (
    <GroupShell
      title="Group Order"
      subtitle={tableNumber ? `Table ${tableNumber}` : null}
      backHref={backHref}
      bottomPadding="pb-12"
    >
      <div className="rounded-card border border-hairline bg-surface p-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-card bg-terracotta-50 text-2xl">
          👥
        </div>
        <h2 className="mt-3 text-lg font-extrabold leading-tight text-carbon-900">
          Order together at this table
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-carbon-400">
          Start a group and share the code with everyone at your table. Each person adds their own
          items from their own phone, and you all see one combined order.
        </p>
      </div>

      {!checkedAuth ? (
        <div className="mt-4 h-24 animate-pulse rounded-card border border-hairline bg-surface" />
      ) : !authed ? (
        <div className="mt-4">
          <CustomerAuthPanel
            title="Verify to join a group"
            description="Everyone at the table sees who added what, so we need to know who you are first."
            onVerified={() => setAuthed(true)}
          />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="w-full rounded-xl bg-terracotta-500 px-4 py-3.5 text-sm font-bold text-white transition active:scale-[0.99] disabled:opacity-50"
          >
            {creating ? 'Creating group…' : 'Create Group'}
          </button>

          <Link
            href={`/menu/${restaurantId}/group/join${contextQuery}`}
            className="block w-full rounded-xl border border-hairline bg-surface px-4 py-3.5 text-center text-sm font-bold text-carbon-900 transition active:scale-[0.99]"
          >
            Join Group
          </Link>

          <Link
            href={`/menu/${restaurantId}${contextQuery}`}
            className="block pt-1 text-center text-sm font-semibold text-carbon-400"
          >
            Order on my own instead
          </Link>
        </div>
      )}
    </GroupShell>
  );
}
