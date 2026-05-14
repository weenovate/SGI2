import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { UsersView } from "./users-view";

export default async function UsuariosPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/dashboard");
  return <UsersView />;
}
