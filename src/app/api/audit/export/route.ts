import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const url = new URL(req.url);
  const where = {
    userId: url.searchParams.get("userId") ?? undefined,
    ip: url.searchParams.get("ip") ?? undefined,
    action: url.searchParams.get("action") ?? undefined,
    entity: url.searchParams.get("entity") ?? undefined,
  };

  const items = await db.auditLog.findMany({
    where: {
      AND: [
        where.userId ? { userId: where.userId } : {},
        where.ip ? { ip: where.ip } : {},
        where.action ? { action: where.action } : {},
        where.entity ? { entity: where.entity } : {},
      ],
    },
    include: { user: { select: { username: true, email: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 10_000,
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Auditoría");
  ws.columns = [
    { header: "Fecha", key: "createdAt", width: 22 },
    { header: "IP", key: "ip", width: 18 },
    { header: "Usuario", key: "userLabel", width: 30 },
    { header: "Acción", key: "action", width: 18 },
    { header: "Entidad", key: "entity", width: 22 },
    { header: "ID", key: "entityId", width: 28 },
    { header: "Antes", key: "before", width: 60 },
    { header: "Después", key: "after", width: 60 },
  ];
  for (const it of items) {
    ws.addRow({
      createdAt: it.createdAt.toISOString(),
      ip: it.ip ?? "",
      userLabel: it.user ? `${it.user.username} (${it.user.role})` : "—",
      action: it.action,
      entity: it.entity,
      entityId: it.entityId ?? "",
      before: it.before ? JSON.stringify(it.before) : "",
      after: it.after ? JSON.stringify(it.after) : "",
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return new NextResponse(buf as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="auditoria-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
