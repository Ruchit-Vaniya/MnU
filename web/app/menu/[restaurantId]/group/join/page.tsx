'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { groupOrdersApi } from '@/lib/api';
import { hasCustomerToken } from '@/lib/customerAuth';
import { setActiveGroupCode } from '@/lib/groupOrder';
import { GroupShell } from '../_components/GroupShell';
import { CustomerAuthPanel } from '../../_components/CustomerAuthPanel';

const CODE_LENGTH = 5;

export default function JoinGroupPage() {
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
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAuthed(hasCustomerToken());
    setCheckedAuth(true);
  }, []);

  const handleJoin = async () => {
    const normalized = code.trim().toUpperCase();
    if (normalized.length !== CODE_LENGTH) {
      setError(`Group codes are ${CODE_LENGTH} characters.`);
      return;
    }
    setJoining(true);
    setError(null);
    try {
      const group = await groupOrdersApi.join(restaurantId, normalized);
      setActiveGroupCode(restaurantId, group.groupCode);
      router.push(`/menu/${restaurantId}/group/${group.groupCode}${contextQuery}`);
    } catch (err) {
      // The server deliberately returns the same message for "wrong
      // code" and "code belongs to another restaurant" — see
      // GroupOrdersService.findGroupOrThrow. Surfaced verbatim rather
      // than reworded, so the two stay indistinguishable client-side too.
      setError(err instanceof Error ? err.message : 'Could not join that group.');
      setJoining(false);
    }
  };

  return (
    <GroupShell
      title="Join Group"
      subtitle={tableNumber ? `Table ${tableNumber}` : null}
      backHref={`/menu/${restaurantId}/group${contextQuery}`}
      bottomPadding="pb-12"
    >
      {!checkedAuth ? (
        <div className="h-24 animate-pulse rounded-card border border-hairline bg-surface" />
      ) : !authed ? (
        <CustomerAuthPanel
          title="Verify to join a group"
          description="Everyone at the table sees who added what, so we need to know who you are first."
          onVerified={() => setAuthed(true)}
        />
      ) : (
        <div className="rounded-card border border-hairline bg-surface p-5">
          <h2 className="text-base font-bold text-carbon-900">Enter the group code</h2>
          <p className="mt-1 text-sm text-carbon-400">
            Ask whoever started the group at your table for their {CODE_LENGTH}-character code.
          </p>

          <input
            value={code}
            onChange={(e) => {
              // Uppercase + strip anything outside the code alphabet as
              // the customer types — the codes are generated without
              // ambiguous characters (no 0/O/1/I/L), so accepting them
              // here would only ever produce a confusing failure.
              setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, CODE_LENGTH));
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleJoin();
            }}
            placeholder="ABC42"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            aria-label="Group code"
            className="mt-4 w-full rounded-xl border border-hairline bg-canvas px-4 py-4 text-center text-2xl font-extrabold tracking-[0.35em] text-carbon-900 outline-none focus:border-brand-400"
          />

          {error && (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleJoin}
            disabled={joining || code.length !== CODE_LENGTH}
            className="mt-4 w-full rounded-xl bg-terracotta-500 px-4 py-3.5 text-sm font-bold text-white transition active:scale-[0.99] disabled:opacity-40"
          >
            {joining ? 'Joining…' : 'Join Group'}
          </button>
        </div>
      )}
    </GroupShell>
  );
}
