'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';

// Ported from mnu_v1 to replace a stale stub — same issue as login/page.tsx
// (see that file's comment). Debug console.log calls from the v1 version
// were dropped (one logged the raw JWT to the browser console).
export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    restaurant_name: '',
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const { token, membership } = await authApi.register(form);
      localStorage.setItem('mnu_token', token);
      // Same reasoning as login/page.tsx — straight to the one restaurant
      // this account just created, no "Your Restaurants" picker.
      router.push(`/restaurants/${membership.restaurant_id}/dashboard`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-ink-100 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500 text-xl text-white">
            🍴
          </div>
          <h1 className="text-xl font-bold text-ink-900">Create your restaurant</h1>
          <p className="mt-1 text-sm text-ink-400">Set up your account to get started</p>
        </div>

        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Restaurant name" value={form.restaurant_name} onChange={update('restaurant_name')} placeholder="The Copper Kettle" />
          <Field label="Your name" value={form.name} onChange={update('name')} placeholder="Jane Doe" />
          <Field label="Email" type="email" value={form.email} onChange={update('email')} placeholder="you@restaurant.com" />
          <Field label="Password" type="password" value={form.password} onChange={update('password')} placeholder="At least 8 characters" />
          <Field
            label="Confirm password"
            type="password"
            value={form.password_confirmation}
            onChange={update('password_confirmation')}
            placeholder="Re-enter password"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-brand-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-400">
          Already have an account?{' '}
          <a href="/login" className="font-semibold text-brand-500">
            Sign in
          </a>
        </p>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-ink-700">{label}</label>
      <input
        type={type}
        required
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-ink-200 px-3 py-2.5 text-sm outline-none focus:border-brand-400"
      />
    </div>
  );
}
