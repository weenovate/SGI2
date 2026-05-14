import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { markExpiringSoon, markExpired } from "@/server/jobs/document-expiry";
import { closeWindow, expireOffers } from "@/server/jobs/enrollment-jobs";

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
    case "documents.markExpiringSoon": {
      const r = await markExpiringSoon();
      return NextResponse.json({ task, ...r });
    }
    case "documents.markExpired": {
      const r = await markExpired();
      return NextResponse.json({ task, ...r });
    }
    case "enrollments.closeWindow": {
      const r = await closeWindow();
      return NextResponse.json({ task, ...r });
    }
    case "waitlist.expireOffers": {
      const r = await expireOffers();
      return NextResponse.json({ task, ...r });
    }
    case "notifications.expire":
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
