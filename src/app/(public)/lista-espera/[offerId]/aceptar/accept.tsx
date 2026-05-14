"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AcceptOffer({ offerId }: { offerId: string }) {
  const accept = api.enrollments.acceptOffer.useMutation();
  const reject = api.enrollments.rejectOffer.useMutation();
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="max-w-md mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Vacante disponible</CardTitle>
          <CardDescription>Tenés una oferta de la lista de espera. Confirmá si querés tomarla.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {state === "ok" && (
            <div>
              <p>✅ Confirmaste la vacante. Tu nueva inscripción es <strong className="font-mono">{code}</strong>.</p>
              <Link href="/mis-inscripciones"><Button className="mt-3">Ir a mis inscripciones</Button></Link>
            </div>
          )}
          {state === "err" && <p className="text-destructive">{error}</p>}
          {state === "idle" && (
            <div className="flex gap-2">
              <Button onClick={async () => {
                setError(null);
                try { const r = await accept.mutateAsync({ offerId }); setCode(r.code); setState("ok"); }
                catch (e) { setState("err"); setError(e instanceof Error ? e.message : "Error"); }
              }} disabled={accept.isPending}>Aceptar vacante</Button>
              <Button variant="outline" onClick={async () => {
                try { await reject.mutateAsync({ offerId }); setState("ok"); setCode(null); }
                catch (e) { setError(e instanceof Error ? e.message : "Error"); setState("err"); }
              }} disabled={reject.isPending}>Rechazar</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
