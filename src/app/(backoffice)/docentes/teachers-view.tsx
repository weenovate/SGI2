"use client";
import { useEffect, useState } from "react";
import { KeyRound, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { api } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Form = {
  cuit: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  titulacionId: string | null;
  birthDate: string;
};

const empty: Form = { cuit: "", firstName: "", lastName: "", email: "", phone: "", titulacionId: null, birthDate: "" };

export function TeachersView() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState<string | null>(null);
  const [transferTo, setTransferTo] = useState<string>("");
  const [form, setForm] = useState<Form>(empty);
  const [error, setError] = useState<string | null>(null);

  const utils = api.useUtils();
  const list = api.teachers.list.useQuery({ q: q || undefined, includeDeleted: true });
  const titulaciones = api.titulaciones.list.useQuery();
  const byId = api.teachers.byId.useQuery({ id: editingId ?? "" }, { enabled: !!editingId });
  const create = api.teachers.create.useMutation({ onSuccess: () => { utils.teachers.list.invalidate(); setOpen(false); setForm(empty); } });
  const update = api.teachers.update.useMutation({ onSuccess: () => { utils.teachers.list.invalidate(); setOpen(false); setForm(empty); } });
  const reset = api.teachers.resetPassword.useMutation();
  const del = api.teachers.softDelete.useMutation({ onSuccess: () => { utils.teachers.list.invalidate(); setTransferOpen(null); } });

  useEffect(() => {
    if (editingId && byId.data) {
      setForm({
        cuit: byId.data.cuit,
        firstName: byId.data.user.firstName ?? "",
        lastName: byId.data.user.lastName ?? "",
        email: byId.data.user.email,
        phone: byId.data.phone ?? "",
        titulacionId: byId.data.titulacionId ?? null,
        birthDate: byId.data.birthDate ? byId.data.birthDate.toISOString().slice(0, 10) : "",
      });
    }
  }, [editingId, byId.data]);

  function newOne() { setEditingId(null); setForm(empty); setError(null); setOpen(true); }
  function editOne(id: string) { setEditingId(id); setError(null); setOpen(true); }

  async function submit() {
    setError(null);
    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        titulacionId: form.titulacionId,
        birthDate: form.birthDate ? new Date(form.birthDate) : null,
      };
      if (editingId) {
        await update.mutateAsync({ id: editingId, ...payload });
      } else {
        await create.mutateAsync({ cuit: form.cuit, ...payload });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Docentes</h1>
          <p className="text-sm text-muted-foreground">CRUD de docentes con envío automático de credenciales (HU8).</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o CUIT…" className="pl-8 w-64" />
          </div>
          <Button onClick={newOne}><Plus className="h-4 w-4" /> Nuevo</Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>CUIT</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.data?.map((t) => {
            const deleted = !!t.user.deletedAt;
            return (
              <TableRow key={t.id} className={deleted ? "deleted-row" : undefined}>
                <TableCell className="font-mono">{t.cuit}</TableCell>
                <TableCell>{t.user.lastName}, {t.user.firstName}</TableCell>
                <TableCell>{t.user.email}</TableCell>
                <TableCell>{t.phone ?? "—"}</TableCell>
                <TableCell className="text-right">
                  {!deleted && (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => editOne(t.id)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => reset.mutate({ id: t.id })} title="Reset password"><KeyRound className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setTransferOpen(t.id)} title="Eliminar"><Trash2 className="h-4 w-4" /></Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(empty); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar" : "Nuevo"} docente</DialogTitle>
            <DialogDescription>Al crear, se envía email con credenciales temporales.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>CUIT</Label>
              <Input value={form.cuit} disabled={!!editingId} onChange={(e) => setForm({ ...form, cuit: e.target.value })} />
            </div>
            <div><Label>Nombres</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
            <div><Label>Apellidos</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
            <div className="col-span-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Teléfono</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Fecha de nacimiento</Label><Input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} /></div>
            <div className="col-span-2">
              <Label>Titulación</Label>
              <Select value={form.titulacionId ?? "_"} onValueChange={(v) => setForm({ ...form, titulacionId: v === "_" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Sin titulación" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">Sin titulación</SelectItem>
                  {titulaciones.data?.map((tt) => <SelectItem key={tt.id} value={tt.id}>{tt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={create.isPending || update.isPending}>
              {create.isPending || update.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!transferOpen} onOpenChange={(v) => !v && setTransferOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar docente</DialogTitle>
            <DialogDescription>
              Si tiene cursos activos, indicá a quién transferirle las instancias (HU8-4).
            </DialogDescription>
          </DialogHeader>
          <Label>Transferir a</Label>
          <Select value={transferTo || "_"} onValueChange={(v) => setTransferTo(v === "_" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Seleccionar…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_">Ninguno (solo si no tiene cursos activos)</SelectItem>
              {list.data?.filter((tt) => tt.id !== transferOpen).map((tt) => (
                <SelectItem key={tt.id} value={tt.id}>{tt.user.lastName}, {tt.user.firstName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={async () => {
              if (!transferOpen) return;
              try { await del.mutateAsync({ id: transferOpen, transferToTeacherId: transferTo || undefined }); }
              catch (e) { alert(e instanceof Error ? e.message : "Error"); }
            }}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
