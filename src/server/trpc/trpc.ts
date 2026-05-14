import "server-only";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { Session } from "next-auth";
import { auth as nextAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Role } from "@/lib/auth";

export type Context = {
  session: Session | null;
  ip: string | null;
  db: typeof db;
};

export async function createContext(opts: { headers: Headers }): Promise<Context> {
  const session = await nextAuth();
  const ip =
    opts.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    opts.headers.get("x-real-ip") ??
    null;
  return { session, ip, db };
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const tRPC = t;

export const router = t.router;
export const middleware = t.middleware;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});

export function roleProcedure(...roles: Role[]) {
  return protectedProcedure.use(({ ctx, next }) => {
    const role = ctx.session?.user?.role as Role | undefined;
    if (!role || !roles.includes(role)) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next({ ctx });
  });
}

/**
 * Helper para procedures de mutación que también escriben auditoría.
 * Usar como `.mutation(audited(({ ctx, input, log }) => { ... }))`.
 */
export function buildAuditCtx(ctx: Context) {
  return {
    userId: ctx.session?.user?.id ?? null,
    ip: ctx.ip,
  };
}
