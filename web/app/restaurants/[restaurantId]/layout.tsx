'use client';

import { useEffect, useState } from 'react';
import { usePathname, useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi, type AuthUser, type Membership } from '@/lib/api';
import { RestaurantContext } from './restaurant-context';

const NAV_ITEMS = [
  { href: 'dashboard', label: 'Dashboard', icon: IconGrid },
  { href: 'menu', label: 'Menu', icon: IconMenu },
  { href: 'tables', label: 'Tables', icon: IconTable },
  { href: 'orders', label: 'Orders', icon: IconOrders },
  { href: 'customers', label: 'Customers', icon: IconCustomers },
  { href: 'analytics', label: 'Analytics', icon: IconChart },
  { href: 'settings', label: 'Settings', icon: IconSettings },
] as const;

export default function RestaurantLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ restaurantId: string }>();
  const restaurantId = params.restaurantId;

  const [user, setUser] = useState<AuthUser | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('mnu_token')) {
      router.push('/login');
      return;
    }
    authApi
      .me()
      .then((res) => {
        setUser(res.user);
        setMemberships(res.memberships);
      })
      .catch(() => {
        localStorage.removeItem('mnu_token');
        router.push('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const membership = memberships.find((m) => m.restaurant_id === restaurantId) ?? null;

  const handleLogout = () => {
    // Best-effort — the token is discarded client-side regardless of
    // whether the network call succeeds, since that's what actually ends
    // the session from the browser's point of view. Same pattern as the
    // top-level /dashboard's sign-out.
    authApi.logout().finally(() => {
      localStorage.removeItem('mnu_token');
      router.push('/login');
    });
  };

  if (loading) {
    return <p className="p-6 text-sm text-ink-400">Loading...</p>;
  }

  if (error) {
    return <p className="p-6 text-sm text-red-600">{error}</p>;
  }

  // Membership check runs client-side to keep the UI from ever rendering
  // restaurant-scoped screens for a non-member; every data call underneath
  // (menuApi, tablesApi, etc.) enforces the same restriction server-side
  // regardless, via each service's requireMembership() — this is a UX
  // guard, not the actual security boundary.
  if (!user || !membership) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <p className="text-sm text-red-600">You don&apos;t have access to this restaurant.</p>
        <Link href="/dashboard" className="mt-3 inline-block text-sm font-semibold text-brand-600">
          ← Back to your dashboard
        </Link>
      </div>
    );
  }

  return (
    <RestaurantContext.Provider value={{ user, membership, memberships }}>
      <div className="min-h-screen bg-cream-100 md:flex">
        {/* Mobile top bar with nav toggle — sidebar itself is md+ only */}
        <div className="flex items-center justify-between border-b border-ink-100 bg-white px-4 py-3 md:hidden">
          <button
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-label="Toggle navigation"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink-200 text-ink-700"
          >
            <IconMenuToggle />
          </button>
          <span className="truncate px-3 text-sm font-bold text-ink-900">{membership.restaurant_name}</span>
          <div className="h-9 w-9" />
        </div>

        <Sidebar restaurantId={restaurantId} pathname={pathname} open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            user={user}
            membership={membership}
            memberships={memberships}
            restaurantId={restaurantId}
            onLogout={handleLogout}
          />
          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </RestaurantContext.Provider>
  );
}

// ---------------------------------------------------------------------------

function Sidebar({
  restaurantId,
  pathname,
  open,
  onClose,
}: {
  restaurantId: string;
  pathname: string;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {/* Mobile drawer backdrop */}
      {open && (
        <div className="fixed inset-0 z-20 bg-black/30 md:hidden" aria-hidden onClick={onClose} />
      )}
      <aside
        className={`z-30 w-60 shrink-0 border-r border-ink-100 bg-white px-3 py-5 md:sticky md:top-0 md:block md:h-screen ${
          open ? 'fixed inset-y-0 left-0 block' : 'hidden'
        }`}
      >
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500 text-sm text-white">
            🍴
          </div>
          <span className="text-sm font-bold text-ink-900">MnU</span>
        </div>

        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const href = `/restaurants/${restaurantId}/${item.href}`;
            const isActive = pathname.startsWith(href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={href}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                  isActive ? 'bg-brand-50 text-brand-600' : 'text-ink-700 hover:bg-cream-100'
                }`}
              >
                <Icon active={isActive} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 border-t border-ink-100 pt-4 px-2">
          <Link href="/dashboard" className="text-xs font-semibold text-ink-400 hover:text-ink-700">
            ← All restaurants
          </Link>
        </div>
      </aside>
    </>
  );
}

function Header({
  user,
  membership,
  memberships,
  restaurantId,
  onLogout,
}: {
  user: AuthUser;
  membership: Membership;
  memberships: Membership[];
  restaurantId: string;
  onLogout: () => void;
}) {
  const router = useRouter();

  return (
    <header className="hidden items-center justify-between border-b border-ink-100 bg-white px-8 py-4 md:flex">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-lg font-bold text-ink-900">{membership.restaurant_name}</h1>
          <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-600">
            {membership.role}
          </span>
        </div>

        {memberships.length > 1 && (
          <select
            value={restaurantId}
            onChange={(e) => router.push(`/restaurants/${e.target.value}/dashboard`)}
            className="mt-1 rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs text-ink-700 outline-none focus:border-brand-400"
            aria-label="Switch restaurant"
          >
            {memberships.map((m) => (
              <option key={m.restaurant_id} value={m.restaurant_id}>
                {m.restaurant_name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-semibold text-ink-900">{user.name}</p>
          <p className="text-xs text-ink-400">{user.email}</p>
        </div>
        <button
          onClick={onLogout}
          className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:border-red-300 hover:text-red-600"
        >
          Logout
        </button>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Minimal inline icons — no icon library is installed, and this dashboard
// foundation doesn't warrant adding one for six glyphs.

function IconMenuToggle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </svg>
  );
}

function iconProps(active?: boolean) {
  return {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: active ? 2.4 : 2,
    className: 'shrink-0',
  } as const;
}

function IconGrid({ active }: { active?: boolean }) {
  return (
    <svg {...iconProps(active)}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  );
}

function IconMenu({ active }: { active?: boolean }) {
  return (
    <svg {...iconProps(active)}>
      <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
    </svg>
  );
}

function IconTable({ active }: { active?: boolean }) {
  return (
    <svg {...iconProps(active)}>
      <rect x="3" y="6" width="18" height="4" rx="1" />
      <path d="M6 10v8M18 10v8" strokeLinecap="round" />
    </svg>
  );
}

function IconOrders({ active }: { active?: boolean }) {
  return (
    <svg {...iconProps(active)}>
      <path d="M5 4h14l-1.5 12.5a2 2 0 0 1-2 1.5H8.5a2 2 0 0 1-2-1.5L5 4Z" />
      <path d="M9 4V3a3 3 0 0 1 6 0v1" strokeLinecap="round" />
    </svg>
  );
}

function IconCustomers({ active }: { active?: boolean }) {
  return (
    <svg {...iconProps(active)}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M14.8 13.6c2.4.4 4.2 2.4 4.2 5.4" strokeLinecap="round" />
    </svg>
  );
}

function IconChart({ active }: { active?: boolean }) {
  return (
    <svg {...iconProps(active)}>
      <path d="M4 20V10M12 20V4M20 20v-7" strokeLinecap="round" />
    </svg>
  );
}

function IconSettings({ active }: { active?: boolean }) {
  return (
    <svg {...iconProps(active)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13a7.97 7.97 0 0 0 0-2l2-1.5-2-3.5-2.4.7a8 8 0 0 0-1.7-1L14.8 3h-4l-.5 2.7a8 8 0 0 0-1.7 1l-2.4-.7-2 3.5L6.2 11a7.97 7.97 0 0 0 0 2l-2 1.5 2 3.5 2.4-.7a8 8 0 0 0 1.7 1l.5 2.7h4l.5-2.7a8 8 0 0 0 1.7-1l2.4.7 2-3.5-2-1.5Z" />
    </svg>
  );
}
