// Stubs y env mínimo para tests unitarios de servicios server-side.
import { vi } from "vitest";

vi.mock("server-only", () => ({}));

process.env.DATABASE_URL ??= "mysql://test:test@localhost:3306/test";
process.env.AUTH_SECRET ??= "test-secret-min-16-chars-12345";
process.env.AUTH_URL ??= "http://localhost:3000";
process.env.APP_URL ??= "http://localhost:3000";
process.env.UPLOADS_DIR ??= "./uploads";
process.env.CRON_SECRET ??= "test-cron-secret";
