"use client";
import { useState } from "react";
import { KeyRound, Plus, Search, Trash2 } from "lucide-react";
import { api } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CountPill } from "@/components/count-pill";

export function StudentsBackoffice({ canRestore }: { canRestore: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ docTypeId: "", docNumber: "", firstName: "", lastName: "", email: "" });
  const [error, setError] = useState<string | null>(null);

  const utils = api.useUtils();
  const tipos = api.tiposDocId.list.useQuery();
  const list = api.students.list.useQuery({ q: q || undefined, includeDeleted: true });
  const totalAll = api.students.list.useQuery({ includeDeleted: true });
  const create = api.students.create.useMutation({ onSuccess: () => { utils.students.list.invalidate(); setOpen(false); setForm({ docTypeId: "", docNumber: "", firstName: "", lastName: "", email: "" }); } });
  const reset = api.students.resetPassword.useMutation();
  const del = api.students.softDelete.useMutation({ onSuccess: () => utils.students.list.invalidate() });
  const restore = api.students.restore.useMutation({ onSuccess: () => utils.students.list.invalidate() });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            Alumnos
            <CountPill total={totalAll.data?.length} filtered={q ? list.data?.length : undefined} loading={list.isLoading || totalAll.isLoading} />
          </h1>
          <p className="text-sm text-muted-foreground">CRUD de alumnos (HU10). El alta envía credenciales por email.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="pl-8 w-72" />
          </div>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nuevo</Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>DNI</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.data?.map((u) => {
            const deleted = !!u.deletedAt;
            return (
              <TableRow key={u.id} className={deleted ? "deleted-row" : undefined}>
                <TableCell className="font-mono">{u.studentProfile?.docNumber ?? u.username}</TableCell>
                <TableCell>{u.lastName ?? ""}, {u.firstName ?? ""}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  {deleted ? <Badge variant="destructive">Eliminado</Badge> :
                    u.status === "active" ? <Badge variant="success">Activo</Badge> :
                    <Badge variant="warning">{u.status}</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  {!deleted && (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => reset.mutate({ id: u.id })} title="Reset password"><KeyRound className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("¿Eliminar?")) del.mutate({ id: u.id }); }}><Trash2 className="h-4 w-4" /></Button>
                    </>
                  )}
                  {deleted && canRestore && <Button variant="outline" size="sm" onClick={() => restore.mutate({ id: u.id })}>Restaurar</Button>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo alumno</DialogTitle>
            <DialogDescription>Se le enviarán credenciales temporales y un enlace para verificar el email.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo doc</Label>
              <Select value={form.docTypeId || "_"} onValueChange={(v) => setForm({ ...form, docTypeId: v === "_" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{tipos.data?.map((t) => <SelectItem key={t.id} value={t.id}>{t.code}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>N° documento</Label><Input value={form.docNumber} onChange={(e) => setForm({ ...form, docNumber: e.target.value.replace(/\D/g, "") })} /></div>
            <div><Label>Nombres</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
            <div><Label>Apellidos</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
            <div className="col-span-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={async () => { setError(null); try { await create.mutateAsync(form); } catch (e) { setError(e instanceof Error ? e.message : "Error"); } }} disabled={create.isPending}>
              {create.isPending ? "Creando…" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
