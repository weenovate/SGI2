import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CronogramaView } from "./cronograma-view";

export default async function CronogramaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["admin", "bedel"].includes(session.user.role)) redirect("/dashboard");
  return <CronogramaView canRestore={session.user.role === "admin"} />;
}
