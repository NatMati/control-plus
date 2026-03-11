// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_ROUTES = ["/", "/login", "/register", "/forgot-password", "/auth/callback", "/privacidad", "/terminos"];
const AUTH_ROUTES   = ["/login", "/register", "/forgot-password"];

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  // Usar @supabase/ssr — mismo sistema que el servidor
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Propagar cookies al request y al response
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Leer sesión — esto también refresca el token si expiró
  const { data: { session } } = await supabase.auth.getSession();

  const pathname   = req.nextUrl.pathname;
  const isPublic   = PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + "/"));
  const isAuthPage = AUTH_ROUTES.some(r => pathname === r);

  // Si tiene sesión y va a login/register → al dashboard
  if (session && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Si no tiene sesión y la ruta no es pública → al login
  if (!session && !isPublic) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)).*)",
  ],
};
