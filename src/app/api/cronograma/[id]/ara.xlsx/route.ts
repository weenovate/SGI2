import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import ExcelJS from "exceljs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Genera la planilla ARA para una instancia: carga el template
 * `templates/ARA.xlsx`, completa los campos del curso y la lista de
 * alumnos inscriptos. El layout de celdas está fijado a la hoja
 * original del cliente y NO se debe modificar.
 *
 * Solo admin / bedel pueden descargar.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  if (!["admin", "bedel"].includes(session.user.role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await ctx.params;

  const inst = await db.courseInstance.findUnique({
    where: { id },
    include: {
      course: true,
      teacher: { include: { user: true } },
      enrollments: {
        where: {
          deletedAt: null,
          status: { in: ["preinscripto", "validar_pago", "inscripto"] },
        },
        include: {
          student: { include: { studentProfile: true } },
        },
        orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
      },
    },
  });
  if (!inst) return new NextResponse("Not found", { status: 404 });

  // Misma lógica de cierre que el UI: manual, cupo lleno o fecha
  // pasada. La planilla ARA solo se entrega cuando la instancia
  // efectivamente cerró sus inscripciones.
  const taken = inst.enrollments.length;
  const isFull = inst.vacancies > 0 && taken >= inst.vacancies;
  const closeAt = new Date(inst.startDate.getTime() - inst.hoursBeforeClose * 3600_000);
  const closeAtPassed = closeAt.getTime() <= Date.now();
  const isClosed = inst.enrollmentClosed || isFull || closeAtPassed;
  if (!isClosed) {
    return new NextResponse("La planilla solo está disponible cuando la instancia está cerrada.", { status: 409 });
  }

  // Map docTypeId → label, en un solo SELECT
  const docTypeIds = Array.from(
    new Set(
      inst.enrollments
        .map((e) => e.student.studentProfile?.docTypeId)
        .filter((v): v is string => !!v),
    ),
  );
  const docTypes = docTypeIds.length
    ? await db.tipoDocumentoIdentidad.findMany({ where: { id: { in: docTypeIds } } })
    : [];
  const docTypeLabel = new Map(docTypes.map((t) => [t.id, t.label]));

  // Cargamos el template y rellenamos celdas. Usamos cell.value = …
  // (no addRow) para preservar formato/celdas combinadas del original.
  const templatePath = join(process.cwd(), "templates", "ARA.xlsx");
  const buf = await readFile(templatePath);
  const wb = new ExcelJS.Workbook();
  // ExcelJS espera ArrayBuffer; lo construimos en base al Buffer leído.
  await wb.xlsx.load(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return new NextResponse("Template inválido", { status: 500 });

  const modalityLabel: Record<string, string> = {
    virtual: "Virtual",
    presencial: "Presencial",
    hibrido: "Híbrida",
  };
  const teacherName = inst.teacher
    ? `${inst.teacher.user.firstName ?? ""} ${inst.teacher.user.lastName ?? ""}`.trim()
    : "";

  // Cabecera del curso. K7 está formateada como texto en la plantilla
  // (`numFmt = "@"`) así que pasamos string. D9/F9 quedan como Date —
  // ExcelJS los serializa con el numFmt `mm-dd-yy` que ya tiene la celda.
  ws.getCell("D9").value = inst.startDate;
  ws.getCell("F9").value = inst.endDate;
  ws.getCell("K7").value = String(inst.edition);
  ws.getCell("E46").value = inst.course.name;
  ws.getCell("E47").value = inst.course.stcwRule ?? "";
  ws.getCell("E49").value = modalityLabel[inst.modality] ?? inst.modality;
  ws.getCell("E50").value = teacherName;

  // Filas de alumnos: B11..M44 (máximo 34 alumnos). Si hay más, los
  // dejamos afuera del documento y devolvemos un warning en header.
  //
  // La plantilla original trae datos mockup (fórmulas de auto-numerado
  // en B, fórmulas tipo "DNI" en C, "ARG" en F, espacios en L/M, etc.).
  // Esos no son parte del template "real" — los limpiamos antes de
  // rellenar para evitar valores fantasma en filas sin alumno.
  const MAX_ROWS = 34;
  const truncated = inst.enrollments.length > MAX_ROWS;
  const rows = inst.enrollments.slice(0, MAX_ROWS);
  const studentCols = ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];
  for (let row = 11; row <= 44; row++) {
    for (const col of studentCols) {
      ws.getCell(`${col}${row}`).value = null;
    }
  }
  for (let i = 0; i < rows.length; i++) {
    const e = rows[i]!;
    const row = 11 + i;
    const sp = e.student.studentProfile;
    ws.getCell(`B${row}`).value = i + 1;
    ws.getCell(`C${row}`).value = sp?.docTypeId ? docTypeLabel.get(sp.docTypeId) ?? "" : "";
    ws.getCell(`D${row}`).value = sp?.docNumber ?? "";
    ws.getCell(`E${row}`).value = sp?.birthDate ?? null;
    ws.getCell(`F${row}`).value = sp?.nationality ?? "";
    ws.getCell(`G${row}`).value = e.student.lastName ?? "";
    ws.getCell(`H${row}`).value = e.student.firstName ?? "";
    ws.getCell(`I${row}`).value = e.student.email ?? "";
    ws.getCell(`J${row}`).value = inst.course.abbr;
    // K, L, M se dejan sin completar (no especificadas).
  }

  const filename = `ARA-${inst.course.abbr}-${inst.edition}.xlsx`;
  const out = await wb.xlsx.writeBuffer();
  return new NextResponse(out as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      ...(truncated ? { "X-Truncated": String(inst.enrollments.length) } : {}),
    },
  });
}
