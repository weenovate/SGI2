import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CourseDetail } from "./course-detail";

export const dynamic = "force-dynamic";

export default async function PublicCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  // HU2-1: si no está logueado, lo mandamos al login con el callback al detalle
  if (!session?.user) {
    redirect(`/login?callbackUrl=/cursos/${encodeURIComponent(id)}`);
  }
  return <CourseDetail id={id} />;
}
