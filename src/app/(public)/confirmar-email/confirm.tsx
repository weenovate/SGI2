"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";

export function ConfirmEmailChange() {
  const search = useSearchParams();
  const token = search.get("token");
  const confirm = api.students.confirmEmailChange.useMutation();
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return setState("err");
    confirm.mutateAsync({ token })
      .then(() => setState("ok"))
      .catch((e) => { setState("err"); setErr(e instanceof Error ? e.message : "Error"); });
  }, [token]);

  if (state === "idle") return <p className="text-muted-foreground">Confirmando…</p>;
  if (state === "ok") return (
    <div className="space-y-3">
      <p>✅ Email actualizado. Por favor volvé a iniciar sesión con el nuevo email.</p>
      <Link href="/login"><Button>Ir al login</Button></Link>
    </div>
  );
  return <p className="text-destructive">No se pudo confirmar: {err ?? "token inválido"}</p>;
}
