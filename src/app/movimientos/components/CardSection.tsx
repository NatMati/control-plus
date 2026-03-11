"use client";

import React from "react";

export default function CardSection({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}
