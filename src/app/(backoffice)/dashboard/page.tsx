import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { BackofficeDashboard } from "./backoffice-dashboard";

export default async function Page() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["admin", "bedel", "manager"].includes(session.user.role)) redirect("/login");
  return <BackofficeDashboard role={session.user.role} />;
}
