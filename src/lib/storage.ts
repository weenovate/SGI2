import "server-only";
import { promises as fs } from "node:fs";
import { createReadStream } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { env } from "./env";

/**
 * Almacenamiento privado fuera del webroot.
 * Nunca se sirve por Apache/cPanel directamente; las descargas pasan por
 * /api/files/[...path] con validación de sesión y permisos.
 */

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export class StorageError extends Error {}

function rootDir() {
  return path.resolve(env.UPLOADS_DIR);
}

export async function ensureRoot() {
  await fs.mkdir(rootDir(), { recursive: true });
}

/**
 * Guarda un buffer en disco bajo `bucket/<uuid>.<ext>` y devuelve la
 * referencia (para almacenar en DB). El nombre original se persiste en DB,
 * nunca se expone en URL.
 */
export async function saveFile(opts: {
  bucket: "documents" | "payments" | "branding" | "tmp";
  filename: string;
  mime: string;
  buffer: Buffer;
  maxBytes?: number;
}) {
  if (!ALLOWED_MIME.has(opts.mime)) {
    throw new StorageError(`Tipo de archivo no admitido: ${opts.mime}`);
  }
  const max = opts.maxBytes ?? 15 * 1024 * 1024;
  if (opts.buffer.byteLength > max) {
    throw new StorageError(`Archivo demasiado grande (max ${max} bytes)`);
  }

  const id = crypto.randomUUID();
  const ext = path.extname(opts.filename).toLowerCase().slice(1) || mimeToExt(opts.mime);
  const rel = path.join(opts.bucket, `${id}.${ext}`);
  const abs = path.join(rootDir(), rel);

  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, opts.buffer, { mode: 0o640 });

  return {
    id,
    bucket: opts.bucket,
    relPath: rel,
    size: opts.buffer.byteLength,
    mime: opts.mime,
    originalName: opts.filename,
  };
}

export async function readStream(relPath: string) {
  const abs = safeAbs(relPath);
  await fs.access(abs);
  return createReadStream(abs);
}

export async function readBuffer(relPath: string) {
  const abs = safeAbs(relPath);
  return fs.readFile(abs);
}

export async function deleteFile(relPath: string) {
  const abs = safeAbs(relPath);
  await fs.unlink(abs).catch(() => undefined);
}

function safeAbs(relPath: string) {
  const abs = path.resolve(rootDir(), relPath);
  if (!abs.startsWith(rootDir() + path.sep) && abs !== rootDir()) {
    throw new StorageError("Path traversal bloqueado");
  }
  return abs;
}

function mimeToExt(mime: string) {
  return mime === "image/jpeg"
    ? "jpg"
    : mime === "image/png"
      ? "png"
      : mime === "image/webp"
        ? "webp"
        : mime === "application/pdf"
          ? "pdf"
          : "bin";
}
