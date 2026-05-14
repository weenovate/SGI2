import "server-only";
import crypto from "node:crypto";
import { db } from "./db";

export type TokenPurpose =
  | "verify-email"
  | "reset-password"
  | "change-email"; // identifier guarda "<userId>:<newEmail>"

function key(purpose: TokenPurpose, identifier: string) {
  return `${purpose}::${identifier}`;
}

export async function issueToken(opts: { purpose: TokenPurpose; identifier: string; ttlHours: number }) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + opts.ttlHours * 3600_000);
  // Limpieza previa
  await db.verificationToken.deleteMany({ where: { identifier: key(opts.purpose, opts.identifier) } });
  await db.verificationToken.create({
    data: { identifier: key(opts.purpose, opts.identifier), token, expires },
  });
  return token;
}

export async function consumeToken(opts: { purpose: TokenPurpose; token: string }) {
  const row = await db.verificationToken.findUnique({ where: { token: opts.token } });
  if (!row) return null;
  if (row.expires < new Date()) {
    await db.verificationToken.delete({ where: { token: opts.token } }).catch(() => undefined);
    return null;
  }
  const prefix = `${opts.purpose}::`;
  if (!row.identifier.startsWith(prefix)) return null;
  await db.verificationToken.delete({ where: { token: opts.token } });
  return { identifier: row.identifier.slice(prefix.length) };
}
