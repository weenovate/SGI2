"use client";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetForm() {
  const search = useSearchParams();
  const token = search.get("token");
  const request = api.registration.requestPasswordReset.useMutation();
  const confirm = api.registration.confirmPasswordReset.useMutation();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [done, setDone] = useState<"requested" | "reset" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (token) {
    if (done === "reset") {
      return (
        <div className="space-y-3">
          <p>✅ Contraseña actualizada.</p>
          <Link href="/login"><Button>Ir a Login</Button></Link>
        </div>
      );
    }
    return (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          try {
            await confirm.mutateAsync({ token, password: pwd });
            setDone("reset");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Error");
          }
        }}
        className="space-y-3"
      >
        <p>Ingresá tu nueva contraseña.</p>
        <div><Label>Contraseña (mín. 8)</Label><Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} /></div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={confirm.isPending || pwd.length < 8}>
          {confirm.isPending ? "Guardando…" : "Cambiar contraseña"}
        </Button>
      </form>
    );
  }

  if (done === "requested") {
    return (
      <p>Si la cuenta existe, te enviamos un email con el enlace para restablecer la contraseña.</p>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          await request.mutateAsync({ email });
          setDone("requested");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Error");
        }
      }}
      className="space-y-3"
    >
      <p>Ingresá tu email y te enviaremos un enlace para resetear la contraseña.</p>
      <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={request.isPending}>
        {request.isPending ? "Enviando…" : "Enviar enlace"}
      </Button>
    </form>
  );
}
