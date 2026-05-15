"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/trpc/react";
import { toast } from "@/lib/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function MyDataForm() {
  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-semibold">Mis datos</h1>
      <Tabs defaultValue="perfil">
        <TabsList>
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="password">Contraseña</TabsTrigger>
        </TabsList>
        <TabsContent value="perfil"><PerfilTab /></TabsContent>
        <TabsContent value="email"><EmailTab /></TabsContent>
        <TabsContent value="password"><PasswordTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function PerfilTab() {
  const me = api.students.me.useQuery();
  const titulaciones = api.titulaciones.list.useQuery();
  const sindicatos = api.sindicatos.list.useQuery();
  const empresas = api.companies.listForStudents.useQuery();
  const provincias = api.geo.provincias.useQuery({ paisId: "ARG" });
  const update = api.students.updateProfile.useMutation({ onSuccess: () => toast.success("Datos guardados") });
  const [form, setForm] = useState({
    firstName: "", lastName: "", birthDate: "", nationality: "",
    titulacionId: "", empresaId: "", sindicatoId: "", phone: "",
    countryId: "ARG", provinciaId: "", localidadId: "",
    street: "", streetNumber: "", floor: "", unit: "",
  });
  const localidades = api.geo.localidades.useQuery({ provinciaId: form.provinciaId }, { enabled: !!form.provinciaId });

  useEffect(() => {
    if (me.data) {
      setForm({
        firstName: me.data.firstName ?? "",
        lastName: me.data.lastName ?? "",
        birthDate: me.data.studentProfile?.birthDate ? me.data.studentProfile.birthDate.toISOString().slice(0, 10) : "",
        nationality: me.data.studentProfile?.nationality ?? "",
        titulacionId: me.data.studentProfile?.titulacionId ?? "",
        empresaId: me.data.studentProfile?.empresaId ?? "",
        sindicatoId: me.data.studentProfile?.sindicatoId ?? "",
        phone: me.data.studentProfile?.phone ?? "",
        countryId: me.data.studentProfile?.countryId ?? "ARG",
        provinciaId: me.data.studentProfile?.provinciaId ?? "",
        localidadId: me.data.studentProfile?.localidadId ?? "",
        street: me.data.studentProfile?.street ?? "",
        streetNumber: me.data.studentProfile?.streetNumber ?? "",
        floor: me.data.studentProfile?.floor ?? "",
        unit: me.data.studentProfile?.unit ?? "",
      });
    }
  }, [me.data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Datos personales</CardTitle>
        <CardDescription>Tipo y número de documento no se pueden modificar.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        <div><Label>Nombres</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
        <div><Label>Apellidos</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
        <div><Label>Tipo doc</Label><Input disabled value={me.data?.studentProfile?.docTypeId ?? ""} /></div>
        <div><Label>Nº documento</Label><Input disabled value={me.data?.studentProfile?.docNumber ?? ""} /></div>
        <div><Label>Fecha de nacimiento</Label><Input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} /></div>
        <div><Label>Nacionalidad</Label><Input value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} /></div>
        <div className="col-span-2">
          <Label>Titulación</Label>
          <Select value={form.titulacionId || "_"} onValueChange={(v) => setForm({ ...form, titulacionId: v === "_" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_">Sin titulación</SelectItem>
              {titulaciones.data?.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label>Empresa</Label>
          <Select value={form.empresaId || "_"} onValueChange={(v) => setForm({ ...form, empresaId: v === "_" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_">Sin empresa</SelectItem>
              {empresas.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label>Sindicato</Label>
          <Select value={form.sindicatoId || "_"} onValueChange={(v) => setForm({ ...form, sindicatoId: v === "_" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_">Sin sindicato</SelectItem>
              {sindicatos.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.sigla} — {s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2"><Label>Teléfono</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>

        <div className="col-span-2 mt-4 font-medium text-sm">Dirección</div>
        <div>
          <Label>Provincia</Label>
          <Select value={form.provinciaId || "_"} onValueChange={(v) => setForm({ ...form, provinciaId: v === "_" ? "" : v, localidadId: "" })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_">—</SelectItem>
              {provincias.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Localidad</Label>
          <Select value={form.localidadId || "_"} onValueChange={(v) => setForm({ ...form, localidadId: v === "_" ? "" : v })} disabled={!form.provinciaId}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_">—</SelectItem>
              {localidades.data?.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2"><Label>Calle</Label><Input value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} /></div>
        <div><Label>Altura</Label><Input value={form.streetNumber} onChange={(e) => setForm({ ...form, streetNumber: e.target.value })} /></div>
        <div><Label>Piso</Label><Input value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} /></div>
        <div><Label>Depto</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>

        <div className="col-span-2">
          <Button onClick={() => update.mutate({
            firstName: form.firstName,
            lastName: form.lastName,
            birthDate: form.birthDate ? new Date(form.birthDate) : null,
            nationality: form.nationality || null,
            titulacionId: form.titulacionId || null,
            empresaId: form.empresaId || null,
            sindicatoId: form.sindicatoId || null,
            phone: form.phone || null,
            countryId: form.countryId || null,
            provinciaId: form.provinciaId || null,
            localidadId: form.localidadId || null,
            street: form.street || null,
            streetNumber: form.streetNumber || null,
            floor: form.floor || null,
            unit: form.unit || null,
          })} disabled={update.isPending}>
            {update.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EmailTab() {
  const me = api.students.me.useQuery();
  const request = api.students.requestEmailChange.useMutation();
  const [newEmail, setNewEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cambiar email</CardTitle>
        <CardDescription>Email actual: {me.data?.email}. Te enviaremos un enlace al nuevo email para confirmar (HU5-2).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div><Label>Nuevo email</Label><Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
        <div><Label>Tu contraseña actual</Label><Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} /></div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {done && <p className="text-sm text-emerald-700">Te enviamos el enlace de confirmación.</p>}
        <Button onClick={async () => {
          setError(null); setDone(false);
          try { await request.mutateAsync({ newEmail, password: pwd }); setDone(true); }
          catch (e) { setError(e instanceof Error ? e.message : "Error"); }
        }} disabled={request.isPending}>{request.isPending ? "Enviando…" : "Enviar confirmación"}</Button>
      </CardContent>
    </Card>
  );
}

function PasswordTab() {
  const change = api.students.changePassword.useMutation();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Cambiar contraseña</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div><Label>Contraseña actual</Label><Input type="password" value={cur} onChange={(e) => setCur(e.target.value)} /></div>
        <div><Label>Nueva contraseña (mín. 8)</Label><Input type="password" value={next} onChange={(e) => setNext(e.target.value)} /></div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {done && <p className="text-sm text-emerald-700">Contraseña actualizada.</p>}
        <Button onClick={async () => {
          setError(null); setDone(false);
          try { await change.mutateAsync({ currentPassword: cur, newPassword: next }); setDone(true); setCur(""); setNext(""); }
          catch (e) { setError(e instanceof Error ? e.message : "Error"); }
        }} disabled={change.isPending || next.length < 8}>{change.isPending ? "Guardando…" : "Cambiar contraseña"}</Button>
      </CardContent>
    </Card>
  );
}
