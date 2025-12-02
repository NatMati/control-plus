"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useSettings } from "@/context/SettingsContext";

type TabKey = "acciones" | "etfs" | "cripto" | "bonos" | "metales";

function cls(...s: (string | false | null | undefined)[]) {
  return s.filter(Boolean).join(" ");
}

export default function AssetTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { t } = useSettings();

  const tabs = useMemo(
    () =>
      ([
        { k: "acciones", label: t("tabs.acciones") },
        { k: "etfs", label: t("tabs.etfs") },
        { k: "cripto", label: t("tabs.cripto") },
        { k: "bonos", label: t("tabs.bonos") },
        { k: "metales", label: t("tabs.metales") },
      ] as { k: TabKey; label: string }[]),
    [t]
  );

  const active: TabKey = useMemo(() => {
    const tparam = sp.get("type")?.toLowerCase() as TabKey | null;
    return tparam && tabs.some((x) => x.k === tparam) ? tparam : "acciones";
  }, [sp, tabs]);

  const go = (k: TabKey) => {
    const next = new URLSearchParams(sp.toString());
    next.set("type", k);
    router.replace(`${pathname}?${next.toString()}`);
  };

  return (
    <nav
      className="flex flex-wrap items-center gap-2 mb-6"
      role="tablist"
      aria-label="Tipos de activos"
    >
      {tabs.map((ti) => {
        const isActive = ti.k === active;
        return (
          <button
            key={ti.k}
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? "page" : undefined}
            onClick={() => go(ti.k)}
            className={cls(
              "px-3 py-1.5 rounded-md text-sm border transition focus:outline-none focus:ring-2 focus:ring-sky-600",
              isActive
                ? "bg-sky-600/20 text-sky-300 border-sky-700"
                : "text-slate-300 hover:bg-slate-800/60 border-transparent"
            )}
          >
            {ti.label}
          </button>
        );
      })}
    </nav>
  );
}
