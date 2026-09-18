// MenuItem has no image field in the schema yet (see docs/PROGRESS.md,
// Day 11: "no image field exists on MenuItem"). Rather than fabricating
// image URLs or leaving every card with an identical grey box, this picks
// a deterministic icon + tone per item so the grid still reads as food at
// a glance and different dishes are visually distinguishable. Swapping in
// real photography later just means rendering an <img> when a url exists
// and falling back to this — nothing else in the UI needs to change.
const ICONS = ['🍔', '🍕', '🍜', '🥗', '🍣', '🍛', '🥘', '🍰', '🥤', '🍟', '🍲', '🌮'];

// Stays within the existing MnU token palette (brand/ink/cream) rather
// than introducing new hues — three warm, muted tones is enough variety
// for a placeholder grid without competing with real food photography
// whenever an image field is added later.
const TONES = ['bg-brand-50', 'bg-brand-100', 'bg-ink-100'];

function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function foodVisual(seed: string): { icon: string; tone: string } {
  const h = hash(seed);
  return {
    icon: ICONS[h % ICONS.length],
    tone: TONES[Math.floor(h / ICONS.length) % TONES.length],
  };
}
