import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { TeachersView } from "./teachers-view";

export default async function DocentesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["admin", "bedel"].includes(session.user.role)) redirect("/dashboard");
  return <TeachersView />;
}
