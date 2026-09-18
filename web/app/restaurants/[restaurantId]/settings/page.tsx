'use client';

import { useRestaurantContext } from '../restaurant-context';

// Only real, already-available data — restaurant name, current user, and
// role — no restaurant-settings backend endpoint exists yet, so nothing
// here is editable.
export default function RestaurantSettingsPage() {
  const { user, membership } = useRestaurantContext();

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="text-xl font-bold text-ink-900">Settings</h2>
      <p className="mt-1 text-sm text-ink-400">Restaurant profile and preferences.</p>

      <div className="mt-6 space-y-4 rounded-2xl border border-ink-100 bg-white p-5">
        <Field label="Restaurant name" value={membership.restaurant_name} />
        <Field label="Your role" value={membership.role} />
        <Field label="Signed in as" value={`${user.name} (${user.email})`} />
      </div>

      <div className="mt-4 rounded-2xl border border-dashed border-ink-200 bg-white p-6 text-center">
        <p className="text-sm font-semibold text-ink-900">More settings coming soon</p>
        <p className="mt-1 text-xs text-ink-400">
          Editing restaurant details, staff management, and preferences aren&apos;t built yet.
        </p>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      <p className="mt-0.5 text-sm text-ink-900">{value}</p>
    </div>
  );
}
