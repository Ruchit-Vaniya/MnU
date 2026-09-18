interface HomeSectionProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

// Shared horizontal-scroll row used by Featured, New Arrivals, and
// Popular — same card width/gap everywhere so the Home page reads as
// one consistent system rather than three different carousels. Scrolls
// only within itself (`overflow-x-auto` scoped to this row), never the
// page — this is what keeps the page itself free of horizontal scroll
// per the Day 14 mobile requirements.
export function HomeSection({ title, subtitle, children }: HomeSectionProps) {
  return (
    <section>
      <div className="px-4">
        <h2 className="text-sm font-bold text-carbon-900">{title}</h2>
        {subtitle && <p className="text-xs text-carbon-400">{subtitle}</p>}
      </div>
      <div
        className="mt-2.5 flex gap-3 overflow-x-auto px-4 pb-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {children}
      </div>
    </section>
  );
}
