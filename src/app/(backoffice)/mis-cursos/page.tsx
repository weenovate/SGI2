import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { MyCourses } from "./my-courses";

export default async function Page() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "docente") redirect("/dashboard");
  return <MyCourses />;
}
