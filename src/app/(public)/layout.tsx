import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { auth } from "@/lib/auth";
import { NotificationsBell } from "@/components/notifications-bell";
import { UserMenu } from "@/components/user-menu";
import { APP_VERSION } from "@/lib/version";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user ?? null;
  const role = user?.role ?? null;

  const homeHref =
    role === "alumno"
      ? "/mi-dashboard"
      : role && ["admin", "bedel", "manager", "docente"].includes(role)
        ? "/dashboard"
        : null;
  const profileHref = role === "alumno" ? "/mis-datos" : null;

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-40 border-b bg-white">
        <div className="container mx-auto h-16 flex items-center justify-between gap-4">
          <Link href={homeHref ?? "/calendario"} className="flex items-center" aria-label="FuENN — inicio">
            <BrandLogo height={36} />
          </Link>
          <nav className="text-sm flex items-center gap-3 sm:gap-4">
            {user && homeHref && (
              <Link href={homeHref} className="hover:underline">Inicio</Link>
            )}
            <Link href="/calendario" className="hover:underline">Calendario</Link>
            {user ? (
              <>
                {role === "alumno" && (
                  <>
                    <Link href="/mis-inscripciones" className="hover:underline hidden sm:inline">Mis inscripciones</Link>
                    <Link href="/mi-documentacion" className="hover:underline hidden sm:inline">Mi documentación</Link>
                  </>
                )}
                <NotificationsBell />
                <UserMenu
                  name={user.name ?? user.email ?? "Usuario"}
                  email={user.email ?? undefined}
                  profileHref={profileHref ?? "/"}
                />
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
        © {new Date().getFullYear()} FuENN — Sistema de Gestión de Inscripciones · v{APP_VERSION}
      </footer>
    </div>
  );
}
