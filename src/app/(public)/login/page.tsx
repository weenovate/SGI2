import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/brand-logo";

export default function LoginPage() {
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
