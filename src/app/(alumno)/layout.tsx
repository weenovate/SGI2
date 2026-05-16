import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { BrandLogo } from "@/components/brand-logo";
import { NotificationsBell } from "@/components/notifications-bell";
import { UserMenu } from "@/components/user-menu";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { APP_VERSION } from "@/lib/version";

export default async function AlumnoLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/mi-dashboard");
  if (session.user.role !== "alumno") redirect("/dashboard");

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-40 border-b bg-card text-card-foreground">
        <div className="container mx-auto h-16 flex items-center justify-between gap-4">
          <Link href="/mi-dashboard" className="flex items-center" aria-label="FuENN — inicio">
            <BrandLogo height={36} />
          </Link>
          <nav className="flex items-center gap-3 sm:gap-4 text-sm">
            <Link href="/mi-dashboard" className="hover:underline">Inicio</Link>
            <Link href="/calendario" className="hover:underline">Calendario</Link>
            <Link href="/mis-inscripciones" className="hover:underline">Mis inscripciones</Link>
            <Link href="/mi-documentacion" className="hover:underline">Mi documentación</Link>
            <ThemeSwitcher />
            <NotificationsBell />
            <UserMenu
              name={session.user.name ?? session.user.email ?? "Usuario"}
              email={session.user.email ?? undefined}
              profileHref="/mis-datos"
            />
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
