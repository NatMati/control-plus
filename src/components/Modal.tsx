"use client";

import { useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidthClass?: string; // por defecto w-[520px]
};

export default function Modal({ open, onClose, title, children, maxWidthClass }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className={`bg-[#0f1726] border border-slate-700 rounded-2xl shadow-xl w-full ${maxWidthClass ?? "max-w-[520px]"}`}>
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-semibold">{title}</h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 px-2 py-1 rounded-md"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
          <div className="p-5">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
