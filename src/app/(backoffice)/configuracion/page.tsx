import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ConfigPanel } from "./config-panel";

export default async function ConfiguracionPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") redirect("/dashboard");
  return <ConfigPanel />;
}
