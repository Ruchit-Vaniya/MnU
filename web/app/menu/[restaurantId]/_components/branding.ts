import type { PublicMenu } from '@/lib/api';

// Day 22 — resolves a restaurant's branding into values the customer UI
// can safely use, falling back to the existing MnU palette (Day 21
// tokens) whenever a restaurant hasn't set something or has set
// something unusable.
//
// The validation matters: `primaryColor`/`accentColor` are free-text
// strings on the Restaurant document with no admin UI validating them
// (there's no restaurant-settings API yet — see restaurant.schema.ts).
// They get interpolated into inline `style` values, so anything that
// isn't a plain hex colour is rejected rather than passed through —
// that keeps a malformed value from producing broken CSS, and keeps
// arbitrary stored text out of a style attribute entirely.

// MnU defaults — these are the existing Day 21 design-system values
// (terracotta / sage), not new colours invented for this task.
const DEFAULT_PRIMARY = '#E07A5F';
const DEFAULT_ACCENT = '#556B2F';

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function safeColor(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  return HEX_COLOR.test(trimmed) ? trimmed : fallback;
}

export interface ResolvedBranding {
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  /** True only when the restaurant actually set a usable primary colour. */
  hasCustomColor: boolean;
}

export function resolveBranding(branding: PublicMenu['branding'] | undefined): ResolvedBranding {
  const primary = safeColor(branding?.primaryColor, DEFAULT_PRIMARY);
  return {
    logoUrl: branding?.logoUrl ?? null,
    primaryColor: primary,
    accentColor: safeColor(branding?.accentColor, DEFAULT_ACCENT),
    hasCustomColor: primary !== DEFAULT_PRIMARY,
  };
}
