import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Home raíz. En public host, el middleware delega acá la decisión para
 * poder leer la sesión:
 *   - alumno logueado → /mi-dashboard
 *   - backoffice logueado → /dashboard (en su host)
 *   - anónimo → /calendario
 */
export default async function Home() {
  const session = await auth();
  const role = session?.user?.role;
  if (role === "alumno") redirect("/mi-dashboard");
  if (role && ["admin", "bedel", "manager", "docente"].includes(role)) {
    redirect("/dashboard");
  }
  redirect("/calendario");
}
