import "server-only";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(16),
  AUTH_URL: z.string().url().optional(),
  AUTH_TRUST_HOST: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  COOKIE_DOMAIN: z.string().optional(),
  PUBLIC_HOST: z.string().min(1).default("inscripciones.localhost"),
  BACKOFFICE_HOST: z.string().min(1).default("sgi.localhost"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  UPLOADS_DIR: z.string().min(1).default("./uploads"),
  RESEND_API_KEY: z.string().optional().default(""),
  EMAIL_FROM: z.string().min(1).default("SGI <noreply@example.com>"),
  EMAIL_REPLY_TO: z.string().optional().default(""),
  CRON_SECRET: z.string().min(8).default("change-me"),
  TESSDATA_DIR: z.string().default("./tessdata"),
  TESSERACT_LANG: z.string().default("spa"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
