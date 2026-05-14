import Link from "next/link";
import { auth, signOut } from "@/lib/auth";

export default async function BackofficeLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-dvh flex">
      <aside className="w-60 border-r bg-slate-50 p-4 hidden md:block">
        <Link href="/dashboard" className="block font-semibold text-primary mb-6">
          SGI · Backoffice
        </Link>
        <nav className="text-sm space-y-1">
          <NavLink href="/dashboard" label="Dashboard" />
          <NavLink href="/cronograma" label="Cronograma" />
          <NavLink href="/cursos" label="Cursos" />
          <NavLink href="/docentes" label="Docentes" />
          <NavLink href="/alumnos" label="Alumnos" />
          <NavLink href="/inscripciones" label="Inscripciones" />
          <NavLink href="/documentacion" label="Documentación" />
          <NavLink href="/empresas" label="Empresas" />
          <NavLink href="/usuarios" label="Usuarios (Admin)" />
          <NavLink href="/auditoria" label="Auditoría (Admin)" />
          <NavLink href="/configuracion" label="Configuración (Admin)" />
        </nav>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="border-b bg-white">
          <div className="h-14 flex items-center justify-between px-6">
            <span className="text-sm text-muted-foreground">
              {session?.user?.name ?? "Sin sesión"}
              {session?.user?.role ? ` · ${session.user.role}` : ""}
            </span>
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
