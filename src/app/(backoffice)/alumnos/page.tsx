import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { StudentsBackoffice } from "./students-view";

export default async function Page() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["admin", "bedel"].includes(session.user.role)) redirect("/dashboard");
  return <StudentsBackoffice canRestore={session.user.role === "admin"} />;
}
