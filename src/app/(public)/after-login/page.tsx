import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/**
 * Punto de entrada post-login: redirige al "home" correcto según el rol.
 * Evita que un alumno termine en /dashboard y se rebote a /login?error=forbidden.
 */
export default async function AfterLoginPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role === "alumno") redirect("/mi-dashboard");
  if (["admin", "bedel", "manager", "docente"].includes(role)) redirect("/dashboard");
  // Rol desconocido: a calendario público.
  redirect("/calendario");
}
