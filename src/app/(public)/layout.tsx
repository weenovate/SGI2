import Link from "next/link";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b bg-white">
        <div className="container mx-auto h-14 flex items-center justify-between">
          <Link href="/calendario" className="font-semibold text-primary">
            SGI · FuENN
          </Link>
          <nav className="text-sm flex items-center gap-4">
            <Link href="/calendario" className="hover:underline">Calendario</Link>
            <Link href="/login" className="hover:underline">Ingresar</Link>
            <Link href="/registro" className="rounded bg-primary text-primary-foreground px-3 py-1.5 hover:opacity-90">
              Registrarme
            </Link>
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
