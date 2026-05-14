import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "restore"
  | "approve"
  | "reject"
  | "login.success"
  | "login.failed"
  | "logout"
  | "password.change"
  | "password.reset"
  | "email.change";

export type AuditEntry = {
  userId?: string | null;
  ip?: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  meta?: unknown;
};

export async function audit(entry: AuditEntry) {
  await db.auditLog.create({
    data: {
      userId: entry.userId ?? null,
      ip: entry.ip ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      before: entry.before as Prisma.InputJsonValue | undefined,
      after: entry.after as Prisma.InputJsonValue | undefined,
      meta: entry.meta as Prisma.InputJsonValue | undefined,
    },
  });
}
