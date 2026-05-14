import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuditList } from "./audit-list";

export default async function AuditPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/dashboard");
  return <AuditList />;
}
