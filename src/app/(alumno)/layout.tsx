import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";

export default async function AlumnoLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/mis-datos");
  if (session.user.role !== "alumno") redirect("/dashboard");

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b bg-white">
        <div className="container mx-auto h-14 flex items-center justify-between">
          <Link href="/calendario" className="font-semibold text-primary">SGI · Mi cuenta</Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/calendario" className="hover:underline">Calendario</Link>
            <Link href="/mis-inscripciones" className="hover:underline">Mis inscripciones</Link>
            <Link href="/mi-documentacion" className="hover:underline">Mi documentación</Link>
            <Link href="/mis-datos" className="hover:underline">Mis datos</Link>
            <span className="text-muted-foreground">{session.user.name}</span>
            <form action={async () => { "use server"; await signOut({ redirectTo: "/calendario" }); }}>
              <button className="text-muted-foreground hover:text-foreground" type="submit">Salir</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="flex-1 container mx-auto py-6">{children}</main>
    </div>
  );
}
