import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ConfirmEmailChange } from "./confirm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function Page() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <section className="max-w-md mx-auto py-8">
      <Card>
        <CardHeader><CardTitle>Confirmar nuevo email</CardTitle></CardHeader>
        <CardContent>
          <Suspense fallback={<p className="text-muted-foreground">Procesando…</p>}>
            <ConfirmEmailChange />
          </Suspense>
        </CardContent>
      </Card>
    </section>
  );
}
