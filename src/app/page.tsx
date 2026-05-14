import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

/**
 * Home raíz. En la práctica el middleware redirige según subdominio:
 *   inscripciones.* -> /calendario
 *   sgi.*           -> /dashboard
 *
 * Este fallback solo se ve si se entra por un host no clasificado.
 */
export default function Home() {
  return (
    <main className="container mx-auto py-16 max-w-2xl">
      <BrandLogo height={56} className="mb-6" />
      <h1 className="text-3xl font-bold mb-6">Sistema de Gestión de Inscripciones</h1>
      <p className="text-muted-foreground mb-8">
        Acceso según subdominio:
      </p>
      <ul className="space-y-3">
        <li>
          <strong>inscripciones.fuenn.com</strong>:{" "}
          <Link className="text-primary underline" href="/calendario">
            calendario público de cursos
          </Link>
        </li>
        <li>
          <strong>sgi.fuenn.com</strong>:{" "}
          <Link className="text-primary underline" href="/dashboard">
            backoffice operativo
          </Link>
        </li>
      </ul>
    </main>
  );
}
