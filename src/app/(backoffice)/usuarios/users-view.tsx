"use client";
import { useEffect, useState } from "react";
import { KeyRound, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { api } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Form = { docTypeId: string; docNumber: string; firstName: string; lastName: string; role: "admin" | "bedel" | "manager"; email: string; password: string };
const empty: Form = { docTypeId: "", docNumber: "", firstName: "", lastName: "", role: "bedel", email: "", password: "" };

export function UsersView() {
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | "admin" | "bedel" | "manager">("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [error, setError] = useState<string | null>(null);
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPwd, setResetPwd] = useState("");

  const utils = api.useUtils();
  const tipos = api.tiposDocId.list.useQuery();
  const list = api.users.list.useQuery({
    q: q || undefined,
    role: roleFilter || undefined,
    includeDeleted: true,
  });
  const create = api.users.create.useMutation({ onSuccess: () => { utils.users.list.invalidate(); setOpen(false); setForm(empty); } });
  const update = api.users.update.useMutation({ onSuccess: () => { utils.users.list.invalidate(); setOpen(false); setForm(empty); } });
  const reset = api.users.resetPassword.useMutation({ onSuccess: () => { setResetFor(null); setResetPwd(""); } });
  const del = api.users.softDelete.useMutation({ onSuccess: () => utils.users.list.invalidate() });
  const restore = api.users.restore.useMutation({ onSuccess: () => utils.users.list.invalidate() });

  useEffect(() => {
    if (editingId && list.data) {
      const u = list.data.find((x) => x.id === editingId);
      if (u) {
        setForm({
          docTypeId: "",
          docNumber: u.username,
          firstName: u.firstName ?? "",
          lastName: u.lastName ?? "",
          role: (u.role === "docente" || u.role === "alumno") ? "bedel" : (u.role as Form["role"]),
          email: u.email,
          password: "",
        });
      }
    }
  }, [editingId, list.data]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Usuarios del backoffice</h1>
          <p className="text-sm text-muted-foreground">Admin / Bedel / Manager (HU14). Para Docentes y Alumnos hay vistas dedicadas.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="pl-8 w-56" />
          </div>
          <Select value={roleFilter || "_"} onValueChange={(v) => setRoleFilter(v === "_" ? "" : (v as "admin" | "bedel" | "manager"))}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Rol" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_">Todos</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="bedel">Bedel</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => { setEditingId(null); setForm(empty); setOpen(true); }}><Plus className="h-4 w-4" /> Nuevo</Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuario</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.data?.filter((u) => ["admin", "bedel", "manager"].includes(u.role)).map((u) => {
            const deleted = !!u.deletedAt;
            return (
              <TableRow key={u.id} className={deleted ? "deleted-row" : undefined}>
                <TableCell className="font-mono">{u.username}</TableCell>
                <TableCell>{u.lastName ?? ""}, {u.firstName ?? ""}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell><Badge variant="secondary">{u.role}</Badge></TableCell>
                <TableCell>
                  {deleted ? <Badge variant="destructive">Eliminado</Badge> :
                    u.status === "active" ? <Badge variant="success">Activo</Badge> :
                    <Badge variant="warning">{u.status}</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  {!deleted && (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => { setEditingId(u.id); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setResetFor(u.id)}><KeyRound className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("¿Eliminar?")) del.mutate({ id: u.id }); }}><Trash2 className="h-4 w-4" /></Button>
                    </>
                  )}
                  {deleted && <Button variant="outline" size="sm" onClick={() => restore.mutate({ id: u.id })}>Restaurar</Button>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar" : "Nuevo"} usuario</DialogTitle>
            <DialogDescription>Solo Admin/Bedel/Manager.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {!editingId && (
              <>
                <div>
                  <Label>Tipo de documento</Label>
                  <Select value={form.docTypeId || "_"} onValueChange={(v) => setForm({ ...form, docTypeId: v === "_" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Tipo…" /></SelectTrigger>
                    <SelectContent>
                      {tipos.data?.map((t) => <SelectItem key={t.id} value={t.id}>{t.code}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Nº documento</Label><Input value={form.docNumber} onChange={(e) => setForm({ ...form, docNumber: e.target.value })} /></div>
              </>
            )}
            <div><Label>Nombres</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
            <div><Label>Apellidos</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
            <div className="col-span-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="col-span-2">
              <Label>Rol</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Form["role"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="bedel">Bedel</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!editingId && (
              <div className="col-span-2">
                <Label>Contraseña inicial (mínimo 8)</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={async () => {
              setError(null);
              try {
                if (editingId) {
                  await update.mutateAsync({ id: editingId, firstName: form.firstName, lastName: form.lastName, email: form.email, role: form.role });
                } else {
                  await create.mutateAsync(form);
                }
              } catch (e) { setError(e instanceof Error ? e.message : "Error"); }
            }}>{create.isPending || update.isPending ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetFor} onOpenChange={(v) => !v && setResetFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset de contraseña</DialogTitle></DialogHeader>
          <Label>Nueva contraseña (mínimo 8)</Label>
          <Input type="password" value={resetPwd} onChange={(e) => setResetPwd(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetFor(null)}>Cancelar</Button>
            <Button onClick={() => resetFor && reset.mutate({ id: resetFor, password: resetPwd })} disabled={resetPwd.length < 8}>
              Resetear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
