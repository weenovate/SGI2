import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { readBuffer } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Servidor de archivos privados.
 * URL: /api/files/<bucket>/<uuid>.<ext>
 *
 * Acceso:
 *  - Admin/Bedel/Manager: cualquier archivo.
 *  - Docente: archivos de instancias propias (pendiente de definición).
 *  - Alumno: solo archivos cuyo `ownerUserId === session.user.id` o cuyo
 *    snapshot de inscripción pertenezca al alumno.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { path: parts } = await context.params;
  const relPath = parts.join("/");

  const file = await db.fileObject.findUnique({ where: { relPath } });
  if (!file) return new NextResponse("Not found", { status: 404 });

  const role = session.user.role;
  const allowed =
    role === "admin" || role === "bedel" || role === "manager"
      ? true
      : file.ownerUserId === session.user.id;

  if (!allowed) return new NextResponse("Forbidden", { status: 403 });

  try {
    const buf = await readBuffer(file.relPath);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": file.mime,
        "Content-Length": String(buf.length),
        "Content-Disposition": `inline; filename="${encodeURIComponent(file.originalName)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
