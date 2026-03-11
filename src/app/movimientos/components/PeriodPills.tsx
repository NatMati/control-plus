"use client";

type PeriodKey = "1M" | "3M" | "6M" | "1Y" | "ALL";

const LABELS: Record<PeriodKey, string> = {
  "1M": "1M",
  "3M": "3M",
  "6M": "6M",
  "1Y": "1Y",
  "ALL": "Todo",
};

export default function PeriodPills({
  value,
  onChange,
}: {
  value: PeriodKey;
  onChange: (v: PeriodKey) => void;
}) {
  const items: PeriodKey[] = ["1M", "3M", "6M", "1Y", "ALL"];

  return (
    <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
      {items.map((k) => {
        const active = value === k;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            className={[
              "px-3 py-1.5 text-sm rounded-lg transition",
              active
                ? "bg-white/10 text-white shadow"
                : "text-white/70 hover:text-white hover:bg-white/5",
            ].join(" ")}
          >
            {LABELS[k]}
          </button>
        );
      })}
    </div>
  );
}

export type { PeriodKey };
