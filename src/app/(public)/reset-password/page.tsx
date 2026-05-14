import { Suspense } from "react";
import { ResetForm } from "./reset-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Page() {
  return (
    <section className="max-w-md mx-auto py-8">
      <Card>
        <CardHeader><CardTitle>Restablecer contraseña</CardTitle></CardHeader>
        <CardContent>
          <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
            <ResetForm />
          </Suspense>
        </CardContent>
      </Card>
    </section>
  );
}
