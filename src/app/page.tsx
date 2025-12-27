// src/app/page.tsx
import { redirect } from "next/navigation";

export default function Home() {
  // Landing por defecto: tu Resumen (que en realidad es /dashboard)
  redirect("/dashboard");
}
