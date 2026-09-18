export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4">
      <p className="text-xs font-semibold text-ink-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink-900">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-ink-400">{hint}</p>}
    </div>
  );
}
