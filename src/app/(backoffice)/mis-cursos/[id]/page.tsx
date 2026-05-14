import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { InstanceTeacher } from "./instance-teacher";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["docente", "admin", "bedel"].includes(session.user.role)) redirect("/dashboard");
  const { id } = await params;
  return <InstanceTeacher instanceId={id} />;
}
