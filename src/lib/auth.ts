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

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db) as Adapter,
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  trustHost: true,
  pages: { signIn: "/login" },
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
          where: {
            OR: [{ username }, { email: username }],
            deletedAt: null,
          },
        });
        if (!user || !user.passwordHash) return null;
        if (user.status !== "active") return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

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
