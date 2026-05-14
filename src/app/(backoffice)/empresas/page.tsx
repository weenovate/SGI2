import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CompaniesView } from "./companies-view";

export default async function EmpresasPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["admin", "bedel"].includes(session.user.role)) redirect("/dashboard");
  return <CompaniesView />;
}
