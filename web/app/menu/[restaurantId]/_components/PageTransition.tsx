'use client';

import { useEffect, useState } from 'react';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

// Day 23 — "connected" route transitions (Home → Category → Dish → Cart)
// implemented with plain CSS + React, per the task's own instruction not
// to add an animation library since none was already installed. This
// isn't a cross-route shared-element transition (that needs either a
// library or the browser's experimental View Transitions API, which
// this Next.js version doesn't stably expose) — it's a consistent
// per-page entrance: every screen fades/slides in the same way on
// mount, which is what makes navigating between them feel like one
// connected app rather than a stack of unrelated documents landing
// abruptly. Kept genuinely optional: `key`-ed by the caller (usually
// the route param) if that screen wants to replay it, otherwise it just
// runs once per mount.
export function PageTransition({ children, className = '' }: PageTransitionProps) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    // One rAF is enough to guarantee the initial (pre-animation) class
    // actually paints before the transition starts — without it, some
    // browsers coalesce the class change and skip the animation.
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className={`transition-all duration-300 ease-out ${
        entered ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      } ${className}`}
    >
      {children}
    </div>
  );
}
