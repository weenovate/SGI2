import { APP_VERSION } from "@/lib/version";

// Layout para vistas de autenticación (login). Sin navbar.
// Solo el formulario, centrado, y un footer con el versionado.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <main className="flex-1 container mx-auto py-6">{children}</main>
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} FuENN — Sistema de Gestión de Inscripciones · v{APP_VERSION}
      </footer>
    </div>
  );
}
