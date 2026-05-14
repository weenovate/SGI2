import "server-only";
import type { Prisma, NotificationLevel } from "@prisma/client";
import { db } from "@/lib/db";
import { sendEmail, renderBaseTemplate } from "@/lib/email";
import { env } from "@/lib/env";

export type DispatchOptions = {
  title: string;
  body: string;
  level?: NotificationLevel;
  /** Si se pasa, también envía email (al usuario destino o a la lista). */
  email?: { subject: string; html?: string; text?: string };
  /** Días de validez (default = sin expiración). */
  expiresInDays?: number;
};

/**
 * Crea una notificación in-app para un usuario y opcionalmente le manda email.
 * Si el setting `notifications.enabled` está apagado, no envía email (pero sí
 * graba la notificación in-app).
 */
export async function notifyUser(userId: string, opts: DispatchOptions) {
  const expiresAt = opts.expiresInDays ? new Date(Date.now() + opts.expiresInDays * 86_400_000) : null;
  const created = await db.notification.create({
    data: {
      title: opts.title,
      body: opts.body,
      level: opts.level ?? "info",
      audience: { userIds: [userId] } as Prisma.InputJsonValue,
      expiresAt,
    },
  });

  if (opts.email) {
    const enabledRow = await db.setting.findUnique({ where: { key: "notifications.enabled" } });
    if (enabledRow?.value !== false) {
      const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (user?.email) {
        await sendEmail({
          to: user.email,
          subject: opts.email.subject,
          html: opts.email.html ?? renderBaseTemplate({ title: opts.title, bodyHtml: `<p>${escape(opts.body)}</p>` }),
          text: opts.email.text,
        }).catch((err) => console.error("[notifyUser] email failed", err));
      }
    }
  }

  return created;
}

/**
 * Notifica a todos los usuarios con un rol (in-app).
 */
export async function notifyRole(role: "admin" | "bedel" | "manager" | "docente" | "alumno", opts: Omit<DispatchOptions, "email">) {
  const expiresAt = opts.expiresInDays ? new Date(Date.now() + opts.expiresInDays * 86_400_000) : null;
  return db.notification.create({
    data: {
      title: opts.title,
      body: opts.body,
      level: opts.level ?? "info",
      audience: { roles: [role] } as Prisma.InputJsonValue,
      expiresAt,
    },
  });
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

// ============================================================
// Helpers de "lifecycle" — usados desde routers
// ============================================================

export async function notifyEnrollmentCreated(enrollmentId: string) {
  const e = await db.enrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    include: { instance: { include: { course: true } } },
  });
  await notifyUser(e.studentId, {
    title: "Recibimos tu preinscripción",
    body: `${e.instance.course.name} (${e.code}). Te avisaremos cuando cambie el estado.`,
    level: "info",
    expiresInDays: 30,
    email: {
      subject: "Recibimos tu preinscripción | SGI - FuENN",
      html: renderBaseTemplate({
        title: "Recibimos tu preinscripción",
        bodyHtml: `<p>Te preinscribiste en <strong>${e.instance.course.name}</strong> (${e.instance.course.abbr} ${e.instance.edition}).</p>
          <p>Tu código de inscripción es <strong>${e.code}</strong>.</p>
          <p>Podés seguir el estado en <a href="${env.APP_URL}/mis-inscripciones">${env.APP_URL}/mis-inscripciones</a>.</p>`,
      }),
    },
  });
}

export async function notifyEnrollmentStatusChanged(enrollmentId: string, newStatus: string) {
  const e = await db.enrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    include: { instance: { include: { course: true } } },
  });

  const map: Record<string, { title: string; body: string; level: NotificationLevel }> = {
    validar_pago: { title: "Realizá el pago", body: `Tu preinscripción ${e.code} fue aprobada. Cargá el comprobante para confirmar.`, level: "important" },
    inscripto: { title: "Estás inscripto", body: `Tu inscripción ${e.code} fue confirmada.`, level: "important" },
    rechazado: { title: "Inscripción rechazada", body: `Tu inscripción ${e.code} fue rechazada.`, level: "critical" },
    cancelado: { title: "Inscripción cancelada", body: `Tu inscripción ${e.code} fue cancelada.`, level: "info" },
  };
  const meta = map[newStatus];
  if (!meta) return;
  await notifyUser(e.studentId, {
    ...meta,
    expiresInDays: 30,
    email: {
      subject: `${meta.title} | SGI - FuENN`,
      html: renderBaseTemplate({
        title: meta.title,
        bodyHtml: `<p>${escape(meta.body)}</p>
          <p>Curso: ${e.instance.course.name} (${e.instance.course.abbr} ${e.instance.edition})</p>
          <p><a href="${env.APP_URL}/mis-inscripciones">${env.APP_URL}/mis-inscripciones</a></p>`,
      }),
    },
  });
}

export async function notifyDocumentDecision(documentId: string, decision: "aprobada" | "rechazada") {
  const d = await db.document.findUniqueOrThrow({
    where: { id: documentId },
    include: { tipo: true, student: { include: { user: true } } },
  });
  const title = decision === "aprobada" ? "Documentación aprobada" : "Documentación rechazada";
  const body = decision === "aprobada"
    ? `${d.tipo.label} fue aprobada.`
    : `${d.tipo.label} fue rechazada. ${d.rejectionNotes ?? ""}`;
  await notifyUser(d.student.userId, {
    title, body,
    level: decision === "aprobada" ? "info" : "important",
    expiresInDays: 30,
    email: {
      subject: `${title} | SGI - FuENN`,
      html: renderBaseTemplate({
        title,
        bodyHtml: `<p>${escape(body)}</p>
          <p><a href="${env.APP_URL}/mi-documentacion">Ir a Mi documentación</a></p>`,
      }),
    },
  });
}

export async function notifyPaymentDecision(paymentId: string, decision: "approved" | "rejected") {
  const p = await db.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { enrollment: { include: { instance: { include: { course: true } } } } },
  });
  const title = decision === "approved" ? "Comprobante aprobado" : "Comprobante rechazado";
  const body = decision === "approved"
    ? `Tu pago de ${p.enrollment.code} fue aprobado.`
    : `Tu pago de ${p.enrollment.code} fue rechazado: ${p.rejectedReason ?? ""}`;
  await notifyUser(p.enrollment.studentId, {
    title, body,
    level: decision === "approved" ? "important" : "critical",
    expiresInDays: 30,
    email: {
      subject: `${title} | SGI - FuENN`,
      html: renderBaseTemplate({
        title,
        bodyHtml: `<p>${escape(body)}</p>
          <p>Curso: ${p.enrollment.instance.course.name} (${p.enrollment.instance.course.abbr} ${p.enrollment.instance.edition})</p>`,
      }),
    },
  });
}
