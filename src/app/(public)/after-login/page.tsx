import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Post-login: redirige al host + ruta correctos según el rol.
 *   - alumno  → https://PUBLIC_HOST/mi-dashboard
 *   - admin/bedel/manager/docente → https://BACKOFFICE_HOST/dashboard
 *   - sin sesión → /login
 *
 * Si el usuario entró al login del subdominio "equivocado" (ej. un admin
 * que se logueó en inscripciones.fuenn.com), igualmente lo mandamos al
 * subdominio que le corresponde gracias al COOKIE_DOMAIN compartido.
 */
export default async function AfterLoginPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  const h = await headers();
  const proto = (h.get("x-forwarded-proto") ?? "https").split(",")[0];
  const currentHost = (h.get("x-forwarded-host") ?? h.get("host") ?? "").toLowerCase().split(":")[0];

  const targetHost =
    role === "alumno"
      ? env.PUBLIC_HOST
      : ["admin", "bedel", "manager", "docente"].includes(role)
        ? env.BACKOFFICE_HOST
        : env.PUBLIC_HOST;

  const targetPath = role === "alumno"
    ? "/mi-dashboard"
    : ["admin", "bedel", "manager", "docente"].includes(role)
      ? "/dashboard"
      : "/calendario";

  // Si ya estoy en el host correcto, redirect relativo.
  if (!currentHost || currentHost === targetHost.toLowerCase()) {
    redirect(targetPath);
  }
  redirect(`${proto}://${targetHost}${targetPath}`);
}
