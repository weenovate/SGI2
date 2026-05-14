import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Endpoint único para tareas programadas (ejecutado desde cPanel cron).
 * Llamar con header `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Tasks soportadas (se irán agregando handlers en sprints siguientes):
 *   - documents.markExpiringSoon
 *   - documents.markExpired
 *   - enrollments.closeWindow
 *   - waitlist.expireOffers
 *   - notifications.expire
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ task: string }> },
) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { task } = await context.params;

  switch (task) {
    case "documents.markExpiringSoon":
    case "documents.markExpired":
    case "enrollments.closeWindow":
    case "waitlist.expireOffers":
    case "notifications.expire":
      // Stubs: implementadas en sprints 3-6.
      return NextResponse.json({ task, status: "noop", note: "Handler aún no implementado" });
    default:
      return NextResponse.json({ error: "Unknown task" }, { status: 400 });
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ task: string }> },
) {
  return POST(req, context);
}
