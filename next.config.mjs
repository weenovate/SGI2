/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["tesseract.js", "sharp"],
  generateBuildId: async () => {
    // Build ID determinístico por commit cuando está disponible.
    // En el VPS, el deploy.sh corre desde un checkout limpio.
    return process.env.GIT_COMMIT_SHA ?? `build-${Date.now()}`;
  },
  experimental: {
    serverActions: { bodySizeLimit: "20mb" },
  },
  async headers() {
    return [
      // HTML / navegaciones: nunca cachear en intermediarios ni en el browser.
      // Los assets de _next/static/* tienen hash en el nombre y se cachean
      // agresivamente por separado (default de Next).
      {
        source: "/((?!_next/static|_next/image|favicon.ico|branding|icons).*)",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
        ],
      },
      // Headers de seguridad globales.
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      // Assets estáticos pueden cachearse fuerte: el nombre cambia con el build.
      {
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // Service worker: nunca cachear. Si lo cacheás, el cliente queda
      // pegado al SW viejo y no toma updates.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
