"use client";
import { useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import { Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/trpc/react";
import { toast } from "@/lib/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const tiposDocId = api.tiposDocId.list.useQuery();
  const titulaciones = api.titulaciones.list.useQuery();
  const sindicatos = api.sindicatos.list.useQuery();
  const empresas = api.companies.listForStudents.useQuery();
  const update = api.students.updateProfile.useMutation({ onSuccess: () => toast.success("Datos guardados") });
  const [form, setForm] = useState({
    firstName: "", lastName: "", birthDate: "", nationality: "",
    titulacionId: "", empresaId: "", sindicatoId: "", phone: "",
    countryId: "ARG", provinciaId: "", localidadId: "", postalCode: "",
    street: "", streetNumber: "", floor: "", unit: "",
  });

  const provincias = api.geo.provincias.useQuery({ paisId: "ARG" });
  // Localidades de la provincia seleccionada (para el select);
  // si hay CP cargado, se prefieren las matcheadas por CP.
  const localidades = api.geo.localidades.useQuery(
    { provinciaId: form.provinciaId },
    { enabled: !!form.provinciaId },
  );
  const cpMatches = api.geo.findByPostalCode.useQuery(
    { code: form.postalCode },
    { enabled: form.postalCode.length >= 4 },
  );

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
        postalCode: me.data.studentProfile?.postalCode ?? "",
        street: me.data.studentProfile?.street ?? "",
        streetNumber: me.data.studentProfile?.streetNumber ?? "",
        floor: me.data.studentProfile?.floor ?? "",
        unit: me.data.studentProfile?.unit ?? "",
      });
    }
  }, [me.data]);

  const tipoDocLabel = useMemo(() => {
    const id = me.data?.studentProfile?.docTypeId;
    if (!id) return "";
    return tiposDocId.data?.find((t) => t.id === id)?.label ?? "";
  }, [me.data, tiposDocId.data]);

  // Cuando cambia el CP: si hay matches, autocompletar provincia y
  // preseleccionar la localidad (la primera GeoRef matcheada).
  function onPostalCodeChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    setForm((f) => ({ ...f, postalCode: digits }));
  }

  // Efecto: al recibir resultados del CP, aplicar autocomplete
  useEffect(() => {
    const data = cpMatches.data;
    if (!data || data.length === 0) return;
    // Si todos los matches comparten provincia, fijamos provincia
    const provIds = new Set(data.map((m) => m.provinciaId));
    if (provIds.size === 1) {
      const provinciaId = data[0]!.provinciaId;
      // Buscar primer match con georefLocalidadId resuelto
      const firstGeoref = data.find((m) => m.georefLocalidadId);
      setForm((f) => {
        if (f.provinciaId === provinciaId && (firstGeoref ? f.localidadId === firstGeoref.georefLocalidadId : true)) {
          return f;
        }
        return {
          ...f,
          provinciaId,
          localidadId: firstGeoref?.georefLocalidadId ?? "",
        };
      });
    }
  }, [cpMatches.data]);

  // Cuando cambia la localidad: setear provincia (siempre derivada) y,
  // si la Localidad tiene postalCode representativo, autocompletarlo.
  const localidadByIdQ = api.geo.localidadById.useQuery(
    { id: form.localidadId },
    { enabled: !!form.localidadId },
  );
  useEffect(() => {
    const loc = localidadByIdQ.data;
    if (!loc) return;
    setForm((f) => {
      const next = { ...f };
      if (f.provinciaId !== loc.provinciaId) next.provinciaId = loc.provinciaId;
      if (loc.postalCode && !f.postalCode) next.postalCode = loc.postalCode;
      return next;
    });
  }, [localidadByIdQ.data]);

  // Lista de localidades a mostrar:
  // - Si hay CP con matches que tienen georefLocalidadId, usamos esos.
  // - Si no, todas las de la provincia.
  const localidadOptions = useMemo(() => {
    const cp = cpMatches.data;
    if (cp && cp.length > 0) {
      const matchedGeo = cp.filter((m) => m.georefLocalidadId);
      if (matchedGeo.length > 0) {
        return matchedGeo.map((m) => ({ id: m.georefLocalidadId!, name: m.georefLocalidadName ?? m.localidadName }));
      }
    }
    return localidades.data?.map((l) => ({ id: l.id, name: l.name })) ?? [];
  }, [cpMatches.data, localidades.data]);

  // Provincia label efectiva: priorizamos la localidad consultada; luego
  // el CP; finalmente la lista de provincias completa.
  const provinciaLabel = useMemo(() => {
    if (localidadByIdQ.data?.provincia.name) return localidadByIdQ.data.provincia.name;
    const cpMatch = cpMatches.data?.find((m) => m.provinciaId === form.provinciaId);
    if (cpMatch) return cpMatch.provinciaName;
    const p = provincias.data?.find((x) => x.id === form.provinciaId);
    return p?.name ?? "";
  }, [localidadByIdQ.data, cpMatches.data, form.provinciaId, provincias.data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Datos personales</CardTitle>
        <CardDescription>Tipo y número de documento no se pueden modificar.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        <div><Label>Nombres</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
        <div><Label>Apellidos</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
        <div><Label>Tipo doc</Label><Input disabled value={tipoDocLabel} /></div>
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
        <div className="col-span-2"><Label>Calle</Label><Input value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} /></div>
        <div><Label>Altura</Label><Input value={form.streetNumber} onChange={(e) => setForm({ ...form, streetNumber: e.target.value })} /></div>
        <div><Label>Piso</Label><Input value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} /></div>
        <div><Label>Depto</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
        <div>
          <Label>Cód. postal</Label>
          <Input
            inputMode="numeric"
            value={form.postalCode}
            onChange={(e) => onPostalCodeChange(e.target.value)}
            placeholder="1425"
          />
        </div>
        <div>
          <Label>Localidad</Label>
          <Select
            value={form.localidadId || "_"}
            onValueChange={(v) => setForm({ ...form, localidadId: v === "_" ? "" : v })}
            disabled={localidadOptions.length === 0}
          >
            <SelectTrigger><SelectValue placeholder={localidadOptions.length === 0 ? "Cargá CP o provincia" : "—"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_">—</SelectItem>
              {localidadOptions.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label>Provincia</Label>
          <Input disabled value={provinciaLabel} placeholder="Se completa al elegir localidad" />
        </div>

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
            postalCode: form.postalCode || null,
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
        <PasswordInput label="Tu contraseña actual" value={pwd} onChange={setPwd} />
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
  const [logoutOpen, setLogoutOpen] = useState(false);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Cambiar contraseña</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <PasswordInput label="Contraseña actual" value={cur} onChange={setCur} />
        <PasswordInput label="Nueva contraseña (mín. 8)" value={next} onChange={setNext} />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={async () => {
          setError(null);
          try {
            await change.mutateAsync({ currentPassword: cur, newPassword: next });
            setCur(""); setNext("");
            setLogoutOpen(true);
          } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
        }} disabled={change.isPending || next.length < 8}>{change.isPending ? "Guardando…" : "Cambiar contraseña"}</Button>
      </CardContent>

      <Dialog open={logoutOpen}>
        <DialogContent
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader><DialogTitle>Contraseña actualizada</DialogTitle></DialogHeader>
          <p className="text-sm">
            Por razones de seguridad vas a tener que iniciar sesión nuevamente con tu nueva contraseña.
          </p>
          <DialogFooter>
            <Button onClick={() => signOut({ callbackUrl: "/login" })}>Aceptar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function PasswordInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <Label>{label}</Label>
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10"
        />
        <button
          type="button"
          aria-label={show ? "Ocultar" : "Mostrar"}
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
