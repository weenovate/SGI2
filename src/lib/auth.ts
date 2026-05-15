import "server-only";
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "./db";

export type Role = "admin" | "bedel" | "manager" | "docente" | "alumno";

declare module "next-auth" {
  interface User {
    role: Role;
  }
  interface Session {
    user: {
      id: string;
      role: Role;
      name?: string | null;
      email?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role?: Role;
    uid?: string;
  }
}

const credentialsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

async function getSecuritySettings() {
  const [maxRow, lockRow] = await Promise.all([
    db.setting.findUnique({ where: { key: "security.maxFailedAttempts" } }),
    db.setting.findUnique({ where: { key: "security.lockMinutes" } }),
  ]);
  return {
    maxAttempts: typeof maxRow?.value === "number" ? maxRow.value : 5,
    lockMinutes: typeof lockRow?.value === "number" ? lockRow.value : 15,
  };
}

// COOKIE_DOMAIN permite que la sesión sea cross-subdomain (ej. ".fuenn.com"
// para que inscripciones.fuenn.com y sgi.fuenn.com compartan la cookie).
// En dev con localhost dejarlo vacío.
const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
const isProd = process.env.NODE_ENV === "production";

// Nombres de cookie sin prefijo __Host- cuando hay domain (los __Host-
// no admiten Domain attribute). Si no hay domain, usamos los defaults.
const cookieBase = {
  options: {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: isProd,
    domain: cookieDomain,
  },
};

const cookies = cookieDomain
  ? {
      sessionToken: {
        name: isProd ? "__Secure-authjs.session-token" : "authjs.session-token",
        options: cookieBase.options,
      },
      callbackUrl: {
        name: isProd ? "__Secure-authjs.callback-url" : "authjs.callback-url",
        options: { ...cookieBase.options, httpOnly: false },
      },
      csrfToken: {
        // Sin __Host- prefix porque queremos Domain.
        name: isProd ? "__Secure-authjs.csrf-token" : "authjs.csrf-token",
        options: cookieBase.options,
      },
      pkceCodeVerifier: {
        name: isProd ? "__Secure-authjs.pkce.code_verifier" : "authjs.pkce.code_verifier",
        options: { ...cookieBase.options, maxAge: 900 },
      },
      state: {
        name: isProd ? "__Secure-authjs.state" : "authjs.state",
        options: { ...cookieBase.options, maxAge: 900 },
      },
      nonce: {
        name: isProd ? "__Secure-authjs.nonce" : "authjs.nonce",
        options: cookieBase.options,
      },
    }
  : undefined;

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db) as Adapter,
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  trustHost: true,
  pages: { signIn: "/login" },
  ...(cookies ? { cookies } : {}),
  providers: [
    Credentials({
      name: "Credenciales",
      credentials: {
        username: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { username, password } = parsed.data;

        const user = await db.user.findFirst({
          where: { OR: [{ username }, { email: username }], deletedAt: null },
        });

        const fail = async (reason: string) => {
          await db.loginAttempt.create({
            data: { username, success: false, reason },
          });
          if (user) {
            const settings = await getSecuritySettings();
            const failed = user.failedAttempts + 1;
            const update: { failedAttempts: number; lockedUntil?: Date } = { failedAttempts: failed };
            if (failed >= settings.maxAttempts) {
              update.lockedUntil = new Date(Date.now() + settings.lockMinutes * 60_000);
            }
            await db.user.update({ where: { id: user.id }, data: update });
          }
          return null;
        };

        if (!user || !user.passwordHash) return fail("user_not_found");
        if (user.status !== "active") return fail("user_inactive");

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await db.loginAttempt.create({ data: { username, success: false, reason: "locked" } });
          return null;
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return fail("bad_password");

        await db.user.update({
          where: { id: user.id },
          data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
        });
        await db.loginAttempt.create({ data: { username, success: true } });

        const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
        return {
          id: user.id,
          email: user.email,
          name: fullName.length > 0 ? fullName : user.username,
          role: user.role as Role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = (user as { id: string }).id;
        token.role = (user as { role: Role }).role;
      }
      return token;
    },
    async session({ session, token }) {
      const uid = token.uid as string | undefined;
      const role = token.role as Role | undefined;
      if (uid) session.user.id = uid;
      if (role) session.user.role = role;
      return session;
    },
  },
});
