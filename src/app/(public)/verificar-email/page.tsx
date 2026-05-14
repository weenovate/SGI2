import { Suspense } from "react";
import { VerifyEmail } from "./verify-email";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Page() {
  return (
    <section className="max-w-md mx-auto py-8">
      <Card>
        <CardHeader><CardTitle>Verificar email</CardTitle></CardHeader>
        <CardContent>
          <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
            <VerifyEmail />
          </Suspense>
        </CardContent>
      </Card>
    </section>
  );
}
