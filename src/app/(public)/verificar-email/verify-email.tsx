"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";

export function VerifyEmail() {
  const search = useSearchParams();
  const token = search.get("token");
  const verify = api.registration.verifyEmail.useMutation();
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("err");
      setError("Falta el token");
      return;
    }
    verify.mutateAsync({ token })
      .then(() => setState("ok"))
      .catch((e) => { setState("err"); setError(e instanceof Error ? e.message : "Error"); });
  }, [token]);

  if (state === "idle") return <p className="text-muted-foreground">Verificando…</p>;
  if (state === "ok") return (
    <div className="space-y-3">
      <p>✅ Tu email fue verificado. Ya podés iniciar sesión.</p>
      <Link href="/login"><Button>Ir a Login</Button></Link>
    </div>
  );
  return (
    <div className="space-y-3">
      <p className="text-destructive">No se pudo verificar: {error}</p>
      <Link href="/login"><Button variant="outline">Volver al login</Button></Link>
    </div>
  );
}
