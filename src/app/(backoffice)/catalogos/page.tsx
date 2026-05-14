import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CatalogsTabs } from "./catalogs-tabs";

export default async function CatalogosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["admin", "bedel"].includes(session.user.role)) redirect("/dashboard");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Catálogos</h1>
        <p className="text-sm text-muted-foreground">
          Mantenimiento de los catálogos requeridos por la spec (Anexos B–I) y
          ampliados.
        </p>
      </div>
      <CatalogsTabs canRestore={session.user.role === "admin"} />
    </div>
  );
}
