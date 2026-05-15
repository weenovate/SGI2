import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { BrandLogo } from "@/components/brand-logo";
import { NotificationsBell } from "@/components/notifications-bell";

export default async function BackofficeLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard");
  }
  const role = session.user.role;
  if (role === "alumno") {
    // Un alumno logueado que intenta entrar al backoffice → su área.
    redirect("/mi-dashboard");
  }
  if (!["admin", "bedel", "manager", "docente"].includes(role)) {
    redirect("/login?error=forbidden");
  }

  return (
    <div className="min-h-dvh flex">
      <aside className="w-60 border-r bg-slate-50 p-4 hidden md:block">
        <Link href="/dashboard" className="flex items-center gap-2 mb-6" aria-label="FuENN">
          <BrandLogo height={32} />
        </Link>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-4">Backoffice</p>
        <nav className="text-sm space-y-1">
          <NavLink href="/dashboard" label="Dashboard" />
          {role === "docente" && <NavLink href="/mis-cursos" label="Mis cursos" />}
          {role !== "docente" && (
            <>
              <NavLink href="/cronograma" label="Cronograma" />
              <NavLink href="/cursos" label="Cursos" />
              <NavLink href="/docentes" label="Docentes" />
              <NavLink href="/alumnos" label="Alumnos" />
              <NavLink href="/inscripciones" label="Inscripciones" />
              <NavLink href="/documentacion" label="Documentación" />
              <NavLink href="/empresas" label="Empresas" />
              <NavLink href="/catalogos" label="Catálogos" />
            </>
          )}
          {role === "admin" && (
            <>
              <NavLink href="/usuarios" label="Usuarios" />
              <NavLink href="/auditoria" label="Auditoría" />
              <NavLink href="/configuracion" label="Configuración" />
            </>
          )}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="border-b bg-white">
          <div className="h-14 flex items-center justify-between px-6">
            <span className="text-sm text-muted-foreground">
              {session?.user?.name ?? "Sin sesión"}
              {session?.user?.role ? ` · ${session.user.role}` : ""}
            </span>
            <div className="flex items-center gap-2">
              <NotificationsBell />
              {session?.user && (
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/login" });
                  }}
                >
                  <button className="text-sm text-muted-foreground hover:text-foreground" type="submit">
                    Salir
                  </button>
                </form>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="block px-2 py-1.5 rounded hover:bg-slate-200">
      {label}
    </Link>
  );
}
