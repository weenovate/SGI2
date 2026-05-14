"use client";
import { useEffect, useState } from "react";
import { Check, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { api } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function CompaniesView() {
  const [tab, setTab] = useState("approved");
  const [q, setQ] = useState("");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Empresas</h1>
          <p className="text-sm text-muted-foreground">CRUD + cola de aprobación de empresas sugeridas por alumnos.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="pl-8 w-64" />
          </div>
          <NewCompanyButton />
        </div>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="approved">Aprobadas</TabsTrigger>
          <TabsTrigger value="pending_approval">Pendientes</TabsTrigger>
          <TabsTrigger value="rejected">Rechazadas</TabsTrigger>
        </TabsList>
        <TabsContent value="approved"><CompaniesTable status="approved" q={q} /></TabsContent>
        <TabsContent value="pending_approval"><CompaniesTable status="pending_approval" q={q} /></TabsContent>
        <TabsContent value="rejected"><CompaniesTable status="rejected" q={q} /></TabsContent>
      </Tabs>
    </div>
  );
}

function CompaniesTable({ status, q }: { status: "approved" | "pending_approval" | "rejected"; q: string }) {
  const utils = api.useUtils();
  const list = api.companies.list.useQuery({ status, q: q || undefined, includeDeleted: true });
  const approve = api.companies.approve.useMutation({ onSuccess: () => utils.companies.list.invalidate() });
  const reject = api.companies.reject.useMutation({ onSuccess: () => utils.companies.list.invalidate() });
  const del = api.companies.softDelete.useMutation({ onSuccess: () => utils.companies.list.invalidate() });
  const update = api.companies.update.useMutation({ onSuccess: () => utils.companies.list.invalidate() });
  const [editing, setEditing] = useState<{ id: string; name: string; cuit: string } | null>(null);

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>CUIT</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.data?.map((c) => (
            <TableRow key={c.id} className={c.deletedAt ? "deleted-row" : undefined}>
              <TableCell>{c.name}</TableCell>
              <TableCell>{c.cuit ?? "—"}</TableCell>
              <TableCell>
                {c.status === "approved" && <Badge variant="success">Aprobada</Badge>}
                {c.status === "pending_approval" && <Badge variant="warning">Pendiente</Badge>}
                {c.status === "rejected" && <Badge variant="destructive">Rechazada</Badge>}
              </TableCell>
              <TableCell className="text-right">
                {status === "pending_approval" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => approve.mutate({ id: c.id })}><Check className="h-4 w-4" /> Aprobar</Button>
                    <Button size="sm" variant="ghost" onClick={() => reject.mutate({ id: c.id })}><X className="h-4 w-4" /> Rechazar</Button>
                  </>
                )}
                {status === "approved" && (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => setEditing({ id: c.id, name: c.name, cuit: c.cuit ?? "" })}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("¿Eliminar?")) del.mutate({ id: c.id }); }}><Trash2 className="h-4 w-4" /></Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar empresa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre</Label><Input value={editing?.name ?? ""} onChange={(e) => editing && setEditing({ ...editing, name: e.target.value })} /></div>
            <div><Label>CUIT</Label><Input value={editing?.cuit ?? ""} onChange={(e) => editing && setEditing({ ...editing, cuit: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={async () => { if (!editing) return; await update.mutateAsync({ id: editing.id, name: editing.name, cuit: editing.cuit || null }); setEditing(null); }}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NewCompanyButton() {
  const utils = api.useUtils();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", cuit: "" });
  const create = api.companies.create.useMutation({
    onSuccess: () => { utils.companies.list.invalidate(); setOpen(false); setForm({ name: "", cuit: "" }); },
  });
  // limpieza form al cerrar
  useEffect(() => { if (!open) setForm({ name: "", cuit: "" }); }, [open]);
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nueva</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva empresa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>CUIT (opcional)</Label><Input value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => create.mutate({ name: form.name, cuit: form.cuit || undefined })} disabled={create.isPending}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
