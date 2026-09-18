import { AlertIcon, PlateIcon } from '../../_components/icons';

// Day 22 (Part 2) — the loading state mirrors the real Home layout
// block-for-block (logo + name, chips, search bar, group banner, hero,
// two rails, category rail, full-menu button) so nothing jumps when the
// real content arrives.
//
// HONEST CONSTRAINT: this cannot use the restaurant's own brand colours.
// Branding arrives in the same `getPublicMenu()` response we're waiting
// on, so at first paint there is nothing restaurant-specific to theme
// with — using a colour here would mean either a second blocking request
// or guessing. It therefore uses the MnU default palette (the documented
// fallback for "no branding available"), and the branded header takes
// over the moment data lands.
export function HomeSkeleton() {
  // Day 23 — "premium loading sequence" (Home branding block first, then
  // structure, then category nav, then featured/cards) is implemented
  // as a staged entrance across the SAME skeleton blocks Day 22 already
  // built, not a separate splash step: each block fades/slides in with
  // an increasing delay, and each pulses independently once visible.
  // This intentionally does not — and structurally cannot — wait for
  // real content between stages; the whole layout is still one fetch
  // (menuApi.getPublicMenu), so "the user can start interacting as soon
  // as meaningful content is ready" is unaffected (see PageTransition,
  // which takes over the instant that fetch resolves).
  let stage = 0;
  const next = () => (stage += 1) * 90;

  return (
    <div className="mnu-customer min-h-screen">
      <div className="mx-auto max-w-5xl pb-10">
        {/* Header: logo, name, cart */}
        <div className="animate-fade-slide-up px-4 pb-1 pt-6" style={{ animationDelay: `${next()}ms` }}>
          <div className="flex animate-pulse items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-12 w-12 shrink-0 rounded-hero bg-canvas-deep" />
              <div className="min-w-0">
                <div className="h-3 w-24 rounded bg-canvas-deep" />
                <div className="mt-2 h-5 w-40 rounded bg-canvas-deep" />
              </div>
            </div>
            <div className="h-11 w-11 shrink-0 rounded-soft bg-canvas-deep" />
          </div>

          {/* Context chips */}
          <div className="mt-3 flex animate-pulse gap-1.5">
            <div className="h-6 w-20 rounded-full bg-canvas-deep" />
            <div className="h-6 w-28 rounded-full bg-canvas-deep" />
          </div>

          {/* Search field */}
          <div className="mt-4 h-12 animate-pulse rounded-hero bg-canvas-deep" />
        </div>

        {/* Group banner */}
        <div className="animate-fade-slide-up mt-6 px-4" style={{ animationDelay: `${next()}ms` }}>
          <div className="h-16 animate-pulse rounded-card bg-canvas-deep" />
        </div>

        {/* Featured hero */}
        <div className="animate-fade-slide-up mt-6 px-4" style={{ animationDelay: `${next()}ms` }}>
          <div className="h-44 animate-pulse rounded-hero bg-canvas-deep" />
        </div>

        {/* Two horizontal rails */}
        {[0, 1].map((row) => (
          <div key={row} className="animate-fade-slide-up mt-6 px-4" style={{ animationDelay: `${next()}ms` }}>
            <div className="h-3.5 w-28 animate-pulse rounded bg-canvas-deep" />
            <div className="mt-2.5 flex gap-3 overflow-hidden">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{ animationDelay: `${i * 70}ms` }}
                  className="w-36 shrink-0 animate-pulse rounded-card border border-hairline bg-surface p-2.5 sm:w-40"
                >
                  <div className="aspect-square rounded-xl bg-canvas-deep" />
                  <div className="mt-2 h-3 w-3/4 rounded bg-canvas-deep" />
                  <div className="mt-1.5 h-3 w-1/3 rounded bg-canvas-deep" />
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Category rail */}
        <div className="animate-fade-slide-up mt-6 px-4" style={{ animationDelay: `${next()}ms` }}>
          <div className="h-3.5 w-24 animate-pulse rounded bg-canvas-deep" />
          <div className="mt-2.5 flex gap-2 overflow-hidden">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{ animationDelay: `${i * 60}ms` }}
                className="h-10 w-24 shrink-0 animate-pulse rounded-full bg-canvas-deep"
              />
            ))}
          </div>
        </div>

        {/* Full menu button */}
        <div className="animate-fade-slide-up mt-6 px-4" style={{ animationDelay: `${next()}ms` }}>
          <div className="h-13 animate-pulse rounded-hero bg-canvas-deep" />
        </div>
      </div>
    </div>
  );
}

export function HomeErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-card border border-hairline bg-surface p-8 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-danger-500/10 text-danger-500">
          <AlertIcon />
        </div>
        <p className="text-sm font-semibold text-carbon-900">Couldn&apos;t load this restaurant</p>
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

export function HomeEmptyState() {
  return (
    <div className="mx-4 mt-6 rounded-card border border-dashed border-hairline bg-surface p-8 text-center">
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-canvas-deep text-carbon-400">
        <PlateIcon />
      </div>
      <p className="text-sm font-semibold text-carbon-900">Nothing on the menu yet</p>
      <p className="mt-1 text-sm text-carbon-400">Check back shortly — this restaurant hasn&apos;t added any items.</p>
    </div>
  );
}
