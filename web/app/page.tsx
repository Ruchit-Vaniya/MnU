import Link from 'next/link';

// Landing page for restaurant staff — customers never see this; they
// land straight on a restaurant's menu via its table QR code (see
// /scan/[restaurantId]/[tableId]). Copy fixed (this task, Part 1) to
// match what's actually live: auth, dashboard, menu/table management,
// and real order placement have all existed since earlier days. The
// old "View demo QR menu" card (dummy, self-contained data) has been
// removed from this main entry point — it no longer belongs next to a
// real login/registration flow.
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-cream-100 px-4">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-2xl text-white">
          🍴
        </div>
        <h1 className="text-2xl font-bold text-ink-900">MnU</h1>
        <p className="mt-1 max-w-sm text-sm text-ink-400">
          Restaurant technology platform — QR menus, table ordering, and management.
        </p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        <NavCard href="/login" icon="🔑" title="Staff login" desc="Sign in to manage your menu, tables, and orders" />
        <NavCard
          href="/register"
          icon="✨"
          title="Create a restaurant account"
          desc="Set up your restaurant and start taking QR orders"
        />
      </div>

      <p className="mt-8 max-w-sm text-center text-xs text-ink-400">
        Diners don&apos;t sign in here — they get a menu link by scanning the QR code on their table.
      </p>
    </main>
  );
}

function NavCard({ href, icon, title, desc }: { href: string; icon: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-4 shadow-sm transition-transform active:scale-[0.99]"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-100 text-lg">{icon}</div>
      <div>
        <p className="font-semibold text-ink-900">{title}</p>
        <p className="text-xs text-ink-400">{desc}</p>
      </div>
    </Link>
  );
}
