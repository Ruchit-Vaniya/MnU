'use client';

import Link from 'next/link';
import { ChevronLeftIcon } from '../../_components/icons';

// Shared chrome for all three group screens (entry / join / lobby) so
// they read as one flow rather than three loosely-related pages. Keeps
// the existing MnU header language — sticky, cream, 36px back target,
// truncating title — rather than introducing a new one.
export function GroupShell({
  title,
  subtitle,
  backHref,
  children,
  bottomPadding = 'pb-28',
}: {
  title: string;
  subtitle?: string | null;
  backHref: string;
  children: React.ReactNode;
  bottomPadding?: string;
}) {
  return (
    <div className="mnu-customer min-h-screen">
      <header className="sticky top-0 z-20 border-b border-hairline bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link
            href={backHref}
            aria-label="Go back"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-carbon-700 active:bg-canvas-deep"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold leading-tight text-carbon-900">{title}</h1>
            {subtitle && <p className="truncate text-xs text-carbon-400">{subtitle}</p>}
          </div>
        </div>
      </header>

      <main className={`mx-auto max-w-2xl px-4 pt-5 ${bottomPadding}`}>{children}</main>
    </div>
  );
}
