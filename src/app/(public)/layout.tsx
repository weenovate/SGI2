import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { auth, signOut } from "@/lib/auth";
import { NotificationsBell } from "@/components/notifications-bell";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user ?? null;
  const role = user?.role ?? null;

  // Cuando el usuario ya está logueado, "home" personal según rol
  const homeHref =
    role === "alumno"
      ? "/mi-dashboard"
      : role && ["admin", "bedel", "manager", "docente"].includes(role)
        ? "/dashboard"
        : null;

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b bg-white">
        <div className="container mx-auto h-16 flex items-center justify-between gap-4">
          <Link href="/calendario" className="flex items-center" aria-label="FuENN — inicio">
            <BrandLogo height={36} />
          </Link>
          <nav className="text-sm flex items-center gap-3 sm:gap-4">
            <Link href="/calendario" className="hover:underline">Calendario</Link>
            {user ? (
              <>
                {role === "alumno" && (
                  <>
                    <Link href="/mis-inscripciones" className="hover:underline hidden sm:inline">Mis inscripciones</Link>
                    <Link href="/mi-documentacion" className="hover:underline hidden sm:inline">Mi documentación</Link>
                  </>
                )}
                {homeHref && (
                  <Link href={homeHref} className="hover:underline hidden sm:inline">
                    {role === "alumno" ? "Mi panel" : "Backoffice"}
                  </Link>
                )}
                <NotificationsBell />
                <span className="text-muted-foreground truncate max-w-[12rem]" title={user.email ?? ""}>
                  {user.name ?? user.email}
                </span>
                <form action={async () => { "use server"; await signOut({ redirectTo: "/calendario" }); }}>
                  <button type="submit" className="text-muted-foreground hover:text-foreground">Salir</button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login" className="hover:underline">Ingresar</Link>
                <Link href="/registro" className="rounded bg-primary text-primary-foreground px-3 py-1.5 hover:opacity-90">
                  Registrarme
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1 container mx-auto py-6">{children}</main>
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} FuENN — Sistema de Gestión de Inscripciones
      </footer>
    </div>
  );
}
