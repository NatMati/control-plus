// src/app/upgrade/page.tsx
import { Suspense } from "react";
import UpgradeClient from "./UpgradeClient";

export const metadata = { title: "Planes · Control+" };

export default function UpgradePage() {
  return (
    <Suspense fallback={null}>
      <UpgradeClient />
    </Suspense>
  );
}
