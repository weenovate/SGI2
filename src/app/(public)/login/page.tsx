import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/brand-logo";
import { auth } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  // Si ya está logueado y no hay un callbackUrl explícito, lo mandamos
  // a su home según rol.
  if (session?.user && !params.callbackUrl) {
    redirect("/after-login");
  }
  return (
    <section className="max-w-md mx-auto py-8">
      <div className="flex justify-center mb-4">
        <BrandLogo height={48} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Ingresar a SGI</CardTitle>
          <CardDescription>Usá tu DNI/CUIT/usuario y tu contraseña.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando…</div>}>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </section>
  );
}
