"use client";
import { useState } from "react";
import { api } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function RegisterForm() {
  const tipos = api.tiposDocId.list.useQuery();
  const register = api.registration.registerStudent.useMutation();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    docTypeId: "",
    docNumber: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    birthDate: "",
    acceptTerms: false,
  });

  if (done) {
    return (
      <div className="space-y-3">
        <p>Te enviamos un email para verificar tu cuenta. Revisá tu casilla (y el spam).</p>
        <p className="text-sm text-muted-foreground">Una vez confirmado, ya podés iniciar sesión.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          await register.mutateAsync({
            docTypeId: form.docTypeId,
            docNumber: form.docNumber,
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            password: form.password,
            birthDate: new Date(form.birthDate),
            acceptTerms: form.acceptTerms === true ? true : true as const,
          });
          setDone(true);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Error");
        }
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label>Doc</Label>
          <Select value={form.docTypeId || "_"} onValueChange={(v) => setForm({ ...form, docTypeId: v === "_" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{tipos.data?.map((t) => <SelectItem key={t.id} value={t.id}>{t.code}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label>N° de documento</Label>
          <Input value={form.docNumber} onChange={(e) => setForm({ ...form, docNumber: e.target.value.replace(/\D/g, "") })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label>Nombres</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
        <div><Label>Apellidos</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
      </div>
      <div><Label>Fecha de nacimiento</Label><Input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} /></div>
      <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
      <div><Label>Contraseña (mín. 8)</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={form.acceptTerms} onCheckedChange={(v) => setForm({ ...form, acceptTerms: !!v })} />
        Acepto los Términos y Condiciones
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={register.isPending || !form.acceptTerms}>
        {register.isPending ? "Creando cuenta…" : "Registrarme"}
      </Button>
    </form>
  );
}
