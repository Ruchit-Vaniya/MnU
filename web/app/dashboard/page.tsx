'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';

// No longer a real screen (Part 1: removed the "Welcome / Your
// Restaurants" intermediate page) — login/register now send an admin
// straight to /restaurants/[id]/dashboard themselves. This route stays
// only as a redirector for old bookmarks/back-navigation that still
// point here, so nothing 404s.
export default function DashboardRedirectPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!localStorage.getItem('mnu_token')) {
      router.replace('/login');
      return;
    }
    authApi
      .me()
      .then((res) => {
        if (res.memberships.length === 0) {
          setError('Your account isn\u2019t linked to a restaurant yet.');
          return;
        }
        router.replace(`/restaurants/${res.memberships[0].restaurant_id}/dashboard`);
      })
      .catch(() => {
        localStorage.removeItem('mnu_token');
        router.replace('/login');
      });
  }, [router]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-red-600">{error}</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <p className="text-sm text-ink-400">Loading...</p>
    </main>
  );
}
