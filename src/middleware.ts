import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware multi-host: detecta si el request entra por
 *   - inscripciones.fuenn.com  -> namespace (public)
 *   - sgi.fuenn.com            -> namespace (backoffice)
 *
 * En dev se pueden mapear con `inscripciones.localhost` y `sgi.localhost`.
 *
 * Reescribimos las rutas para que cada host vea solo sus páginas y no haya
 * solapamiento. El home `/` se redirige al destino apropiado.
 */
export function middleware(req: NextRequest) {
  const host = req.headers.get("host")?.toLowerCase().split(":")[0] ?? "";
  const url = req.nextUrl.clone();
  const pathname = url.pathname;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/branding") ||
    pathname.match(/\.(png|jpg|jpeg|webp|svg|ico|css|js|map|txt|webmanifest)$/)
  ) {
    return NextResponse.next();
  }

  const isBackoffice = host.startsWith("sgi.") || host === "sgi.localhost";
  const isPublic = host.startsWith("inscripciones.") || host === "inscripciones.localhost" || host === "localhost" || host === "127.0.0.1";

  // Header útil para layouts / componentes server-side
  const headers = new Headers(req.headers);
  headers.set("x-sgi-host", isBackoffice ? "backoffice" : "public");

  if (isBackoffice && pathname === "/") {
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // En public, dejamos que la page raíz decida (puede leer sesión).
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
