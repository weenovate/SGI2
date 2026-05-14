import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DocsBackoffice } from "./docs-view";

export default async function Page() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["admin", "bedel"].includes(session.user.role)) redirect("/dashboard");
  return <DocsBackoffice />;
}
