import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { THEME_KEYS, type ThemeKey, themeClass } from "@/lib/theme";

export const metadata: Metadata = {
  title: "SGI - FuENN",
  description: "Sistema de Gestión de Inscripciones - FuENN",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0f3a6b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

// Resolución de tema server-side: evita FOUC porque la clase del
// tema se pinta en <html> antes del primer paint.
async function resolveTheme(): Promise<ThemeKey> {
  let userPref: string | null = null;
  try {
    const session = await auth();
    if (session?.user?.id) {
      const u = await db.user.findUnique({
        where: { id: session.user.id },
        select: { themePreference: true },
      });
      userPref = u?.themePreference ?? null;
    }
  } catch {
    // si auth/DB fallan, seguimos con global
  }
  if (userPref && (THEME_KEYS as readonly string[]).includes(userPref)) {
    return userPref as ThemeKey;
  }

  try {
    const s = await db.setting.findUnique({ where: { key: "appearance.theme" } });
    const v = s?.value;
    if (typeof v === "string" && (THEME_KEYS as readonly string[]).includes(v)) {
      return v as ThemeKey;
    }
  } catch {
    // ignore
  }
  return "mar";
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await resolveTheme();
  return (
    <html lang="es" className={themeClass(theme)} suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
