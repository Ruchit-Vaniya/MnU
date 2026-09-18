'use client';

import { AlertIcon, PlateIcon, SearchIcon } from './icons';

export function MenuSkeleton() {
  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 pb-24 pt-4">
      <div className="mb-4 flex animate-pulse items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-canvas-deep" />
        <div className="flex-1">
          <div className="h-4 w-32 rounded bg-canvas-deep" />
          <div className="mt-2 h-3 w-20 rounded bg-canvas-deep" />
        </div>
      </div>
      <div className="mb-5 flex animate-pulse gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-20 shrink-0 rounded-full bg-canvas-deep" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{ animationDelay: `${i * 60}ms` }}
            className="flex animate-fade-slide-up gap-3 rounded-card border border-hairline bg-surface p-3"
          >
            <div className="h-24 w-24 shrink-0 animate-pulse rounded-xl bg-canvas-deep" />
            <div className="flex-1 animate-pulse space-y-2 py-1">
              <div className="h-3.5 w-3/4 rounded bg-canvas-deep" />
              <div className="h-3 w-full rounded bg-canvas-deep" />
              <div className="h-3 w-1/3 rounded bg-canvas-deep" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MenuErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-card border border-hairline bg-surface p-8 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-danger-500/10 text-danger-500">
          <AlertIcon />
        </div>
        <p className="text-sm font-semibold text-carbon-900">Couldn&apos;t load this menu</p>
        <p className="mt-1 text-sm text-carbon-400">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-full bg-terracotta-500 px-5 py-2 text-sm font-semibold text-white active:scale-95"
        >
          Try again
        </button>
      </div>
    </main>
  );
}

export function EmptyMenuState() {
  return (
    <div className="rounded-card border border-dashed border-hairline bg-surface p-8 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-canvas-deep text-carbon-400">
        <PlateIcon />
      </div>
      <p className="text-sm font-semibold text-carbon-900">Nothing on the menu yet</p>
      <p className="mt-1 text-sm text-carbon-400">Check back shortly — this restaurant hasn&apos;t added any items.</p>
    </div>
  );
}

export function EmptySearchState({ query }: { query: string }) {
  return (
    <div className="rounded-card border border-dashed border-hairline bg-surface p-8 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-canvas-deep text-carbon-400">
        <SearchIcon />
      </div>
      <p className="text-sm font-semibold text-carbon-900">No matches for &quot;{query}&quot;</p>
      <p className="mt-1 text-sm text-carbon-400">Try a different dish, drink, or category name.</p>
    </div>
  );
}
