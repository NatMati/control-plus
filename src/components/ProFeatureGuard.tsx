"use client";

import type { ReactNode } from "react";

type ProFeatureGuardProps = {
  title?: string;
  description?: string;
  children: ReactNode;
};

export function ProFeatureGuard({ children }: ProFeatureGuardProps) {
  // Por ahora no bloquea nada, solo devuelve el contenido
  return <>{children}</>;
}

export default ProFeatureGuard;
