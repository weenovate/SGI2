import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { WaitlistManager } from "./waitlist-manager";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["admin", "bedel"].includes(session.user.role)) redirect("/dashboard");
  const { id } = await params;
  return <WaitlistManager instanceId={id} />;
}
