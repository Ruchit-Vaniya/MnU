'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  menuApi,
  tablesApi,
  ordersApi,
  analyticsApi,
  type CategoryRecord,
  type TableRecord,
  type AdminOrderRecord,
  type DashboardAnalytics,
} from '@/lib/api';
import { useRestaurantContext } from '../restaurant-context';
import { MetricCard } from './_components/MetricCard';
import { TrendChart } from './_components/TrendChart';
import { TopItemsList } from './_components/TopItemsList';
import { RecentOrdersList } from './_components/RecentOrdersList';

const MANAGE_ROLES = ['SUPER_ADMIN', 'RESTAURANT_ADMIN'] as const;

export default function RestaurantDashboardPage() {
  const params = useParams<{ restaurantId: string }>();
  const restaurantId = params.restaurantId;
  const { user, membership } = useRestaurantContext();
  const canManage = MANAGE_ROLES.includes(membership.role as (typeof MANAGE_ROLES)[number]);

  const [categories, setCategories] = useState<CategoryRecord[] | null>(null);
  const [tables, setTables] = useState<TableRecord[] | null>(null);
  const [orders, setOrders] = useState<AdminOrderRecord[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsLoadKey, setAnalyticsLoadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([menuApi.getMenu(restaurantId), tablesApi.list(restaurantId), ordersApi.list(restaurantId)])
      .then(([menu, tableList, orderList]) => {
        if (cancelled) return;
        setCategories(menu);
        setTables(tableList);
        setOrders(orderList);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load restaurant status.');
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  // Kept as its own effect/request (rather than folded into the
  // Promise.all above) so a failed analytics fetch doesn't block Quick
  // actions/Current status/Getting started from rendering — those don't
  // depend on it at all, and shouldn't go blank because one aggregation
  // endpoint had a bad moment.
  useEffect(() => {
    let cancelled = false;
    setAnalytics(null);
    setAnalyticsError(null);
    analyticsApi
      .getDashboard(restaurantId)
      .then((data) => {
        if (!cancelled) setAnalytics(data);
      })
      .catch((err) => {
        if (!cancelled) setAnalyticsError(err instanceof Error ? err.message : 'Failed to load analytics.');
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId, analyticsLoadKey]);

  const itemCount = categories?.reduce((sum, c) => sum + c.items.length, 0) ?? 0;
  const availableItemCount = categories?.reduce((sum, c) => sum + c.items.filter((i) => i.isAvailable).length, 0) ?? 0;
  const menuReady = (categories?.length ?? 0) > 0 && itemCount > 0;
  const tablesReady = (tables?.length ?? 0) > 0;
  const ordersReady = (orders?.length ?? 0) > 0;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Welcome */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-ink-900">Welcome back, {user.name.split(' ')[0]}</h2>
        <p className="mt-1 text-sm text-ink-400">
          Here&apos;s what&apos;s going on at <span className="font-semibold text-ink-700">{membership.restaurant_name}</span>.
        </p>
      </div>

      {loadError && (
        <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{loadError}</p>
      )}

      {/* Analytics — the main ask of this task: real numbers, visible
          directly on the dashboard, not tucked away on a separate page. */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink-700">Analytics</h3>
          {analytics && (
            <p className="text-[11px] text-ink-400">
              Today · {new Date().toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric' })} (UTC)
            </p>
          )}
        </div>

        {analyticsError ? (
          <div className="rounded-2xl border border-ink-100 bg-white p-6 text-center">
            <p className="text-sm text-ink-700">Couldn&apos;t load analytics.</p>
            <p className="mt-1 text-xs text-ink-400">{analyticsError}</p>
            <button
              onClick={() => setAnalyticsLoadKey((k) => k + 1)}
              className="mt-3 rounded-full bg-brand-500 px-4 py-1.5 text-xs font-semibold text-white"
            >
              Try again
            </button>
          </div>
        ) : !analytics ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl border border-ink-100 bg-white" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <MetricCard label="Today's Sales" value={`₹${analytics.todaySales}`} hint="UTC calendar day" />
              <MetricCard label="Today's Orders" value={String(analytics.todayOrders)} hint="UTC calendar day" />
              <MetricCard label="Avg Order Value" value={`₹${analytics.averageOrderValue}`} hint="All-time, excl. cancelled" />
              <MetricCard label="Active Orders" value={String(analytics.activeOrders)} hint="New → Ready" />
              <MetricCard label="Completed Orders" value={String(analytics.completedOrders)} hint="All-time" />
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <TrendChart trend={analytics.trend} />
              <div>
                <p className="mb-2 text-xs font-semibold text-ink-400">Top-selling items</p>
                <TopItemsList items={analytics.topItems} />
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-ink-400">Recent orders</p>
              <RecentOrdersList restaurantId={restaurantId} orders={analytics.recentOrders} />
            </div>
          </div>
        )}
      </section>

      {/* Quick actions */}
      <section className="mb-8">
        <h3 className="mb-3 text-sm font-semibold text-ink-700">Quick actions</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <QuickAction href={`/restaurants/${restaurantId}/menu`} label="Manage Menu" hint="Categories & items" icon="📋" />
          <QuickAction href={`/restaurants/${restaurantId}/tables`} label="Manage Tables" hint="Floor & seating" icon="🪑" />
          <QuickAction href={`/restaurants/${restaurantId}/orders`} label="View Orders" hint={`${orders?.length ?? 0} placed`} icon="🧾" />
          <QuickAction href={`/restaurants/${restaurantId}/customers`} label="Customers" hint="Order history" icon="👥" />
          <QuickAction href={`/restaurants/${restaurantId}/settings`} label="Restaurant Settings" hint="Profile & roles" icon="⚙️" />
        </div>
      </section>

      {/* Current status */}
      <section className="mb-8">
        <h3 className="mb-3 text-sm font-semibold text-ink-700">Current status</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatusCard
            title="Menu"
            ready={categories === null ? null : menuReady}
            readyText={`${categories?.length ?? 0} categories · ${itemCount} items (${availableItemCount} available)`}
            emptyText="No menu items yet"
            actionHref={canManage ? `/restaurants/${restaurantId}/menu` : undefined}
            actionLabel="Set up menu"
          />
          <StatusCard
            title="Tables"
            ready={tables === null ? null : tablesReady}
            readyText={`${tables?.length ?? 0} tables configured`}
            emptyText="No tables yet"
            actionHref={canManage ? `/restaurants/${restaurantId}/tables` : undefined}
            actionLabel="Add tables"
          />
          <StatusCard
            title="Orders"
            ready={orders === null ? null : ordersReady}
            readyText={`${orders?.length ?? 0} order${(orders?.length ?? 0) === 1 ? '' : 's'} placed`}
            emptyText="No orders yet"
            actionHref={`/restaurants/${restaurantId}/orders`}
            actionLabel="View orders"
          />
        </div>
      </section>

      {/* Getting started */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-ink-700">Getting started</h3>
        <div className="space-y-2 rounded-2xl border border-ink-100 bg-white p-4">
          <ChecklistItem
            done={menuReady}
            label="Complete your menu"
            hint="Add categories and items so guests know what you serve."
            href={`/restaurants/${restaurantId}/menu`}
          />
          <ChecklistItem
            done={tablesReady}
            label="Add restaurant tables"
            hint="Set up your floor so orders can be tied to a table."
            href={`/restaurants/${restaurantId}/tables`}
          />
          {/* Day 10 note: QR generation now lives on the Tables screen
              itself (a "Generate QR" button per table) rather than a
              separate flow — this checklist item previously said
              "Coming soon" from before that existed. */}
          <ChecklistItem
            done={tablesReady}
            label="Generate QR codes for your tables"
            hint="Each table has its own QR code you can download or print."
            href={`/restaurants/${restaurantId}/tables`}
          />
          <ChecklistItem
            done={ordersReady}
            label="Start accepting orders"
            hint="Orders placed from a customer's table will show up here."
            href={`/restaurants/${restaurantId}/orders`}
          />
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

function QuickAction({
  href,
  label,
  hint,
  icon,
  disabled,
}: {
  href: string;
  label: string;
  hint: string;
  icon: string;
  disabled?: boolean;
}) {
  const content = (
    <div
      className={`flex h-full flex-col gap-2 rounded-2xl border border-ink-100 bg-white p-4 transition-colors ${
        disabled ? 'opacity-60' : 'hover:border-brand-200 hover:bg-brand-50/40'
      }`}
    >
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-ink-900">{label}</p>
        <p className="text-xs text-ink-400">{hint}</p>
      </div>
    </div>
  );

  if (disabled) {
    return <div aria-disabled>{content}</div>;
  }
  return <Link href={href}>{content}</Link>;
}

function StatusCard({
  title,
  ready,
  readyText,
  emptyText,
  actionHref,
  actionLabel,
}: {
  title: string;
  ready: boolean | null;
  readyText: string;
  emptyText: string;
  actionHref?: string;
  actionLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink-900">{title}</p>
        {ready !== null && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              ready ? 'bg-green-50 text-green-700' : 'bg-ink-100 text-ink-400'
            }`}
          >
            {ready ? 'Set up' : 'Not set up'}
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-ink-400">
        {ready === null ? 'Loading...' : ready ? readyText : emptyText}
      </p>
      {ready === false && actionHref && (
        <Link href={actionHref} className="mt-2 inline-block text-xs font-semibold text-brand-600">
          {actionLabel} →
        </Link>
      )}
    </div>
  );
}

function ComingSoonCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink-900">{title}</p>
        <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-400">
          Coming soon
        </span>
      </div>
      <p className="mt-2 text-xs text-ink-400">{text}</p>
    </div>
  );
}

function ChecklistItem({
  done,
  label,
  hint,
  href,
  disabledReason,
}: {
  done: boolean;
  label: string;
  hint: string;
  href?: string;
  disabledReason?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl px-2 py-2">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${
            done ? 'border-green-600 bg-green-600 text-white' : 'border-ink-300 text-transparent'
          }`}
        >
          ✓
        </span>
        <div>
          <p className={`text-sm font-medium ${done ? 'text-ink-400 line-through' : 'text-ink-900'}`}>{label}</p>
          <p className="text-xs text-ink-400">{hint}</p>
        </div>
      </div>
      {href && !done && (
        <Link href={href} className="shrink-0 text-xs font-semibold text-brand-600">
          Go →
        </Link>
      )}
      {disabledReason && (
        <span className="shrink-0 rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-400">
          {disabledReason}
        </span>
      )}
    </div>
  );
}
