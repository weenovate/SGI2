import "server-only";
import { Resend } from "resend";
import { env } from "./env";

let client: Resend | null = null;

function getClient() {
  if (!env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(env.RESEND_API_KEY);
  return client;
}

export type EmailMessage = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export async function sendEmail(msg: EmailMessage) {
  const c = getClient();
  if (!c) {
    if (env.NODE_ENV !== "production") {
      console.warn(`[email] RESEND_API_KEY ausente; mensaje a ${msg.to} no enviado.`);
      console.warn(`[email] subject="${msg.subject}"`);
      return { id: "noop" };
    }
    throw new Error("RESEND_API_KEY no configurada");
  }
  const result = await c.emails.send({
    from: env.EMAIL_FROM,
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    replyTo: msg.replyTo ?? (env.EMAIL_REPLY_TO || undefined),
  });
  if (result.error) throw new Error(result.error.message);
  return { id: result.data?.id ?? "" };
}

export function renderBaseTemplate(opts: { title: string; bodyHtml: string }) {
  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8" /><title>${escape(opts.title)}</title></head>
<body style="font-family: system-ui, -apple-system, Segoe UI, sans-serif; background:#f5f7fa; padding:24px;">
  <div style="max-width:600px; margin:auto; background:#fff; border-radius:8px; padding:24px; border:1px solid #e2e8f0;">
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
