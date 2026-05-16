import "server-only";
import { Resend } from "resend";
import nodemailer, { type Transporter } from "nodemailer";
import { db } from "./db";
import { env } from "./env";

/**
 * Configuración de envío de email. Se lee de la tabla Setting en
 * cada send (acepta que el admin la cambie sin reiniciar el server),
 * con caché en memoria por `CACHE_MS` para evitar martillar la DB.
 *
 * Provider:
 *   - "smtp"   → nodemailer con host/port/user/password/security de DB.
 *   - "resend" → SDK Resend con apiKey de DB (fallback a env).
 *
 * Si `notifications.enabled` está en false, no se envía nada.
 */

type Provider = "smtp" | "resend";

type EmailConfig =
  | { enabled: false }
  | {
      enabled: true;
      provider: "resend";
      from: string;
      replyTo: string;
      apiKey: string;
    }
  | {
      enabled: true;
      provider: "smtp";
      from: string;
      replyTo: string;
      host: string;
      port: number;
      user: string;
      password: string;
      security: "none" | "ssl" | "starttls";
      requireAuth: boolean;
    };

const CACHE_MS = 10_000;
let cache: { at: number; cfg: EmailConfig } | null = null;
let smtpTransport: Transporter | null = null;
let smtpKey: string | null = null;
let resendClient: Resend | null = null;
let resendKey: string | null = null;

async function loadConfig(): Promise<EmailConfig> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.cfg;

  const keys = [
    "notifications.enabled",
    "notifications.client",
    "notifications.resend.apiKey",
    "notifications.resend.from",
    "notifications.smtp.host",
    "notifications.smtp.port",
    "notifications.smtp.user",
    "notifications.smtp.password",
    "notifications.smtp.security",
    "notifications.smtp.requireAuth",
    "notifications.smtp.from",
  ];
  const rows = await db.setting.findMany({ where: { key: { in: keys } } });
  const m = new Map(rows.map((r) => [r.key, r.value]));

  const enabled = m.get("notifications.enabled") !== false;
  if (!enabled) {
    const cfg: EmailConfig = { enabled: false };
    cache = { at: Date.now(), cfg };
    return cfg;
  }

  const rawClient = m.get("notifications.client");
  const provider: Provider = rawClient === "smtp" ? "smtp" : "resend";

  if (provider === "resend") {
    const apiKey = (m.get("notifications.resend.apiKey") as string) || env.RESEND_API_KEY || "";
    const from = (m.get("notifications.resend.from") as string) || env.EMAIL_FROM;
    const cfg: EmailConfig = {
      enabled: true,
      provider: "resend",
      apiKey,
      from,
      replyTo: env.EMAIL_REPLY_TO || "",
    };
    cache = { at: Date.now(), cfg };
    return cfg;
  }

  const host = (m.get("notifications.smtp.host") as string) || "";
  const port = Number(m.get("notifications.smtp.port") ?? 587);
  const user = (m.get("notifications.smtp.user") as string) || "";
  const password = (m.get("notifications.smtp.password") as string) || "";
  const security = (m.get("notifications.smtp.security") as "none" | "ssl" | "starttls") || "starttls";
  const requireAuth = m.get("notifications.smtp.requireAuth") !== false;
  const from = (m.get("notifications.smtp.from") as string) || env.EMAIL_FROM;
  const cfg: EmailConfig = {
    enabled: true,
    provider: "smtp",
    host,
    port,
    user,
    password,
    security,
    requireAuth,
    from,
    replyTo: env.EMAIL_REPLY_TO || "",
  };
  cache = { at: Date.now(), cfg };
  return cfg;
}

function getResend(apiKey: string): Resend | null {
  if (!apiKey) return null;
  if (resendKey !== apiKey || !resendClient) {
    resendClient = new Resend(apiKey);
    resendKey = apiKey;
  }
  return resendClient;
}

function getSmtpTransport(cfg: Extract<EmailConfig, { provider: "smtp" }>): Transporter | null {
  if (!cfg.host) return null;
  // Cachemos el transport por una clave compuesta para invalidarlo
  // cuando cambia cualquier credencial.
  const key = `${cfg.host}|${cfg.port}|${cfg.user}|${cfg.password}|${cfg.security}|${cfg.requireAuth}`;
  if (smtpKey !== key || !smtpTransport) {
    smtpTransport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.security === "ssl", // SSL implícito en 465
      requireTLS: cfg.security === "starttls",
      ignoreTLS: cfg.security === "none",
      auth: cfg.requireAuth && cfg.user ? { user: cfg.user, pass: cfg.password } : undefined,
    });
    smtpKey = key;
  }
  return smtpTransport;
}

// Permite forzar relectura desde la DB (por ejemplo cuando el admin
// guarda nuevos settings desde la UI).
export function invalidateEmailConfigCache() {
  cache = null;
  smtpTransport = null;
  smtpKey = null;
  resendClient = null;
  resendKey = null;
}

export type EmailMessage = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export async function sendEmail(msg: EmailMessage) {
  const cfg = await loadConfig();
  if (!cfg.enabled) {
    if (env.NODE_ENV !== "production") {
      console.warn(`[email] notifications.enabled=false → mensaje a ${msg.to} no enviado.`);
    }
    return { id: "disabled" };
  }

  const replyTo = msg.replyTo ?? (cfg.replyTo || undefined);

  if (cfg.provider === "resend") {
    const c = getResend(cfg.apiKey);
    if (!c) {
      if (env.NODE_ENV !== "production") {
        console.warn(`[email] Resend sin apiKey; mensaje a ${msg.to} no enviado. subject="${msg.subject}"`);
        return { id: "noop" };
      }
      throw new Error("Resend API key no configurada (Configuración → Apariencia/Notificaciones)");
    }
    const result = await c.emails.send({
      from: cfg.from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      replyTo,
    });
    if (result.error) throw new Error(result.error.message);
    return { id: result.data?.id ?? "" };
  }

  // SMTP
  const transport = getSmtpTransport(cfg);
  if (!transport) {
    if (env.NODE_ENV !== "production") {
      console.warn(`[email] SMTP sin host; mensaje a ${msg.to} no enviado. subject="${msg.subject}"`);
      return { id: "noop" };
    }
    throw new Error("SMTP no configurado (Configuración → Notificaciones)");
  }
  const info = await transport.sendMail({
    from: cfg.from,
    to: Array.isArray(msg.to) ? msg.to.join(", ") : msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    replyTo,
  });
  return { id: info.messageId };
}

export function renderBaseTemplate(opts: { title: string; bodyHtml: string }) {
  const logoUrl = `${env.APP_URL}/branding/logo.png`;
  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8" /><title>${escape(opts.title)}</title></head>
<body style="font-family: system-ui, -apple-system, Segoe UI, sans-serif; background:#f5f7fa; padding:24px;">
  <div style="max-width:600px; margin:auto; background:#fff; border-radius:8px; padding:24px; border:1px solid #e2e8f0;">
    <div style="margin-bottom:16px;">
      <img src="${logoUrl}" alt="FuENN" height="40" style="height:40px; width:auto; display:block;" />
    </div>
    <h1 style="font-size:18px; margin:0 0 16px; color:#0f172a;">${escape(opts.title)}</h1>
    ${opts.bodyHtml}
    <hr style="border:none; border-top:1px solid #e2e8f0; margin:24px 0;" />
    <p style="font-size:12px; color:#64748b;">Este mensaje fue generado automáticamente por SGI - FuENN. Si no esperabas recibirlo podés ignorarlo.</p>
  </div>
</body>
</html>`;
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}
