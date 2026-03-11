"use client";

export default function KpiCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-white/60">
        {title}
      </div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      {subtitle ? (
        <div className="mt-1 text-sm text-white/50">{subtitle}</div>
      ) : null}
    </div>
  );
}
