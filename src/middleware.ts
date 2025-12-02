// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
// import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

// 🚫 Por ahora devolvemos siempre next() para probar solo las rutas
export async function middleware(req: NextRequest) {
  return NextResponse.next();
}

// También podés comentar el matcher si querés
export const config = {
  matcher: ["/admin/:path*"],
};
