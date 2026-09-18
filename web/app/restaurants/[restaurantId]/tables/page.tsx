'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { QRCodeCanvas } from 'qrcode.react';
import { authApi, tablesApi, type Membership, type TableRecord, type TableStatus } from '@/lib/api';

const MANAGE_ROLES: Membership['role'][] = ['SUPER_ADMIN', 'RESTAURANT_ADMIN'];
const STATUS_OPTIONS: TableStatus[] = ['AVAILABLE', 'OCCUPIED', 'INACTIVE'];

const STATUS_STYLE: Record<TableStatus, string> = {
  AVAILABLE: 'bg-green-50 text-green-700',
  OCCUPIED: 'bg-amber-50 text-amber-700',
  INACTIVE: 'bg-ink-100 text-ink-400',
};

export default function RestaurantTablesPage() {
  const router = useRouter();
  const params = useParams<{ restaurantId: string }>();
  const restaurantId = params.restaurantId;

  const [membership, setMembership] = useState<Membership | null>(null);
  const [tables, setTables] = useState<TableRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrTable, setQrTable] = useState<TableRecord | null>(null);

  const canManage = !!membership && MANAGE_ROLES.includes(membership.role);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([authApi.me(), tablesApi.list(restaurantId)])
      .then(([me, tableList]) => {
        const match = me.memberships.find((m) => m.restaurant_id === restaurantId);
        if (!match) {
          setError("You don't have access to this restaurant.");
          return;
        }
        setMembership(match);
        setTables(tableList);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load tables.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!localStorage.getItem('mnu_token')) {
      router.push('/login');
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, router]);

  const refresh = async () => {
    const tableList = await tablesApi.list(restaurantId);
    setTables(tableList);
  };

  if (loading) return <p className="p-6 text-sm text-ink-400">Loading tables...</p>;
  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-xs font-semibold text-ink-400">
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-xl font-bold text-ink-900">{membership?.restaurant_name}</h1>
          <p className="text-sm text-ink-400">Tables{!canManage && ' · view only (staff)'}</p>
        </div>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600">
          {membership?.role}
        </span>
      </div>

      {tables.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-400">
          No tables yet. {canManage ? 'Add one below to get started.' : 'Check back once an admin sets up the floor.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {tables.map((table) => (
            <TableCard
              key={table.id}
              restaurantId={restaurantId}
              table={table}
              canManage={canManage}
              onChanged={refresh}
              onShowQr={() => setQrTable(table)}
            />
          ))}
        </div>
      )}

      {canManage && (
        <div className="mt-6">
          <AddTableForm restaurantId={restaurantId} onCreated={refresh} />
        </div>
      )}

      {qrTable && membership && (
        <QrPreviewModal
          restaurantId={restaurantId}
          restaurantName={membership.restaurant_name}
          table={qrTable}
          onClose={() => setQrTable(null)}
        />
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------

function TableCard({
  restaurantId,
  table,
  canManage,
  onChanged,
  onShowQr,
}: {
  restaurantId: string;
  table: TableRecord;
  canManage: boolean;
  onChanged: () => Promise<void>;
  onShowQr: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteTable = async () => {
    if (!confirm(`Delete "${table.tableNumber}"?`)) return;
    setBusy(true);
    setError(null);
    try {
      await tablesApi.delete(restaurantId, table.id);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete table.');
      setBusy(false);
    }
  };

  if (isEditing) {
    return (
      <div className="rounded-2xl border border-ink-100 bg-white p-4">
        <EditTableForm
          restaurantId={restaurantId}
          table={table}
          onDone={async () => {
            setIsEditing(false);
            await onChanged();
          }}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold text-ink-900">{table.tableNumber}</p>
          <p className="text-xs text-ink-400">
            {table.capacity} {table.capacity === 1 ? 'seat' : 'seats'}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLE[table.status]}`}>
          {table.status}
        </span>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-3 flex gap-3 text-xs font-semibold">
        <button onClick={onShowQr} className="text-brand-600 hover:text-brand-700">
          Generate QR
        </button>
        {canManage && (
          <>
            <button onClick={() => setIsEditing(true)} className="text-ink-400 hover:text-ink-700">
              Edit
            </button>
            <button onClick={deleteTable} disabled={busy} className="text-red-500 disabled:opacity-50">
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function AddTableForm({ restaurantId, onCreated }: { restaurantId: string; onCreated: () => Promise<void> }) {
  const [tableNumber, setTableNumber] = useState('');
  const [capacity, setCapacity] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedCapacity = Number(capacity);
    if (!tableNumber.trim()) {
      setError('Table name is required.');
      return;
    }
    if (Number.isNaN(parsedCapacity) || parsedCapacity < 1) {
      setError('Capacity must be a positive number.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await tablesApi.create(restaurantId, { tableNumber, capacity: parsedCapacity });
      setTableNumber('');
      setCapacity('');
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create table.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-dashed border-ink-200 p-4">
      <p className="mb-2 text-sm font-semibold text-ink-700">Add a table</p>
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={tableNumber}
          onChange={(e) => setTableNumber(e.target.value)}
          placeholder="e.g. T01"
          className="flex-1 rounded-xl border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
        />
        <input
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          placeholder="Capacity"
          inputMode="numeric"
          className="w-full rounded-xl border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-400 sm:w-28"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </form>
  );
}

function EditTableForm({
  restaurantId,
  table,
  onDone,
  onCancel,
}: {
  restaurantId: string;
  table: TableRecord;
  onDone: () => Promise<void>;
  onCancel: () => void;
}) {
  const [tableNumber, setTableNumber] = useState(table.tableNumber);
  const [capacity, setCapacity] = useState(String(table.capacity));
  const [status, setStatus] = useState<TableStatus>(table.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedCapacity = Number(capacity);
    if (!tableNumber.trim()) {
      setError('Table name is required.');
      return;
    }
    if (Number.isNaN(parsedCapacity) || parsedCapacity < 1) {
      setError('Capacity must be a positive number.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await tablesApi.update(restaurantId, table.id, { tableNumber, capacity: parsedCapacity, status });
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update table.');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <input
        value={tableNumber}
        onChange={(e) => setTableNumber(e.target.value)}
        className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
        autoFocus
      />
      <input
        value={capacity}
        onChange={(e) => setCapacity(e.target.value)}
        inputMode="numeric"
        className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
      />
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as TableStatus)}
        className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          Save
        </button>
        <button type="button" onClick={onCancel} className="text-xs font-semibold text-ink-400">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Day 10 — QR generation. No new backend model or QR token: the QR simply
// encodes a link to the existing /scan/[restaurantId]/[tableId] page (Day
// 8), which already identifies the restaurant + table and hands off to the
// customer menu (Day 9). Generating a QR is therefore a pure frontend
// concern — render the deep link as a QR image, let the admin download or
// print it.

function QrPreviewModal({
  restaurantId,
  restaurantName,
  table,
  onClose,
}: {
  restaurantId: string;
  restaurantName: string;
  table: TableRecord;
  onClose: () => void;
}) {
  // Only known client-side (SSR has no window/origin) — safe here because
  // this modal only ever mounts in response to a click, well after hydration.
  const [customerUrl, setCustomerUrl] = useState('');

  useEffect(() => {
    setCustomerUrl(`${window.location.origin}/scan/${restaurantId}/${table.id}`);
  }, [restaurantId, table.id]);

  const downloadQr = () => {
    const canvas = document.getElementById(`qr-canvas-${table.id}`) as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `table-${table.tableNumber}-qr.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 print:bg-white">
      {/* Printing only the card itself, not the dimmed backdrop or rest of
          the admin UI behind it. */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #qr-print-area, #qr-print-area * { visibility: visible; }
          #qr-print-area { position: fixed; inset: 0; }
        }
      `}</style>

      <div
        id="qr-print-area"
        className="w-full max-w-xs rounded-2xl border border-ink-100 bg-white p-6 text-center shadow-lg"
      >
        <div className="mb-4 flex items-center justify-between print:hidden">
          <p className="text-sm font-bold text-ink-900">Table QR</p>
          <button onClick={onClose} className="text-xs font-semibold text-ink-400 hover:text-ink-700">
            Close
          </button>
        </div>

        <p className="text-base font-bold text-ink-900">{restaurantName}</p>
        <p className="mb-4 text-sm text-ink-400">Table {table.tableNumber}</p>

        <div className="flex justify-center">
          {customerUrl && (
            <QRCodeCanvas id={`qr-canvas-${table.id}`} value={customerUrl} size={200} level="M" />
          )}
        </div>

        <p className="mt-4 break-all text-xs text-ink-400">{customerUrl}</p>

        <div className="mt-5 flex gap-2 print:hidden">
          <button
            onClick={downloadQr}
            className="flex-1 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Download
          </button>
          <button
            onClick={() => window.print()}
            className="flex-1 rounded-xl border border-ink-200 px-4 py-2.5 text-sm font-semibold text-ink-700"
          >
            Print
          </button>
        </div>
      </div>
    </div>
  );
}
