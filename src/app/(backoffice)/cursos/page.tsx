import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CoursesView } from "./courses-view";

export default async function CursosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["admin", "bedel"].includes(session.user.role)) redirect("/dashboard");
  return <CoursesView canRestore={session.user.role === "admin"} />;
}
