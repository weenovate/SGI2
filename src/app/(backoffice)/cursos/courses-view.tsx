"use client";
import { useEffect, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { api } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CountPill } from "@/components/count-pill";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type FormState = {
  abbr: string;
  name: string;
  categoryId: string | null;
  objectives: string;
  workload: string;
  program: string;
  stcwRule: string;
  requisiteTipoIds: string[];
  propagateToInstances: boolean;
};

const empty: FormState = {
  abbr: "", name: "", categoryId: null, objectives: "", workload: "", program: "", stcwRule: "",
  requisiteTipoIds: [], propagateToInstances: false,
};

export function CoursesView({ canRestore }: { canRestore: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);

  const utils = api.useUtils();
  const list = api.courses.list.useQuery({ q: q || undefined, includeDeleted: true });
  const totalAll = api.courses.list.useQuery({ includeDeleted: true });
  const cats = api.categorias.list.useQuery();
  const tipos = api.tiposDocumentacion.list.useQuery();
  const create = api.courses.create.useMutation({ onSuccess: () => { utils.courses.list.invalidate(); setOpen(false); } });
  const update = api.courses.update.useMutation({ onSuccess: () => { utils.courses.list.invalidate(); setOpen(false); } });
  const del = api.courses.softDelete.useMutation({ onSuccess: () => utils.courses.list.invalidate() });
  const restore = api.courses.restore.useMutation({ onSuccess: () => utils.courses.list.invalidate() });
  const byId = api.courses.byId.useQuery({ id: editingId ?? "" }, { enabled: !!editingId });

  function newCourse() {
    setEditingId(null);
    setForm(empty);
    setError(null);
    setOpen(true);
  }

  function editCourse(id: string) {
    setEditingId(id);
    setError(null);
    setOpen(true);
  }

  useEffect(() => {
    if (editingId && byId.data) {
      setForm({
        abbr: byId.data.abbr,
        name: byId.data.name,
        categoryId: byId.data.categoryId ?? null,
        objectives: byId.data.objectives ?? "",
        workload: byId.data.workload?.toString() ?? "",
        program: byId.data.program ?? "",
        stcwRule: byId.data.stcwRule ?? "",
        requisiteTipoIds: byId.data.requisites.map((r) => r.tipoDocumentacionId),
        propagateToInstances: false,
      });
    }
  }, [editingId, byId.data]);

  async function submit() {
    setError(null);
    const payload = {
      abbr: form.abbr.trim().toUpperCase(),
      name: form.name.trim(),
      categoryId: form.categoryId,
      objectives: form.objectives || undefined,
      workload: form.workload ? Number(form.workload) : null,
      program: form.program || undefined,
      stcwRule: form.stcwRule || null,
      requisiteTipoIds: form.requisiteTipoIds,
    };
    try {
      if (editingId) {
        await update.mutateAsync({ id: editingId, ...payload, propagateToInstances: form.propagateToInstances });
      } else {
        await create.mutateAsync(payload);
      }
      setForm(empty);
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            Cursos
            <CountPill total={totalAll.data?.total} filtered={q ? list.data?.total : undefined} loading={list.isLoading || totalAll.isLoading} />
          </h1>
          <p className="text-sm text-muted-foreground">CRUD de cursos maestros (HU7).</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="pl-8 w-64" />
          </div>
          <Button onClick={newCourse}><Plus className="h-4 w-4" /> Nuevo</Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sigla</TableHead>
            <TableHead>Nombre</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Carga horaria</TableHead>
            <TableHead>Instancias</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Cargando…</TableCell></TableRow>}
          {list.data?.items.map((c) => {
            const deleted = !!c.deletedAt;
            return (
              <TableRow key={c.id} className={deleted ? "deleted-row" : undefined}>
                <TableCell className="font-mono">{c.abbr}</TableCell>
                <TableCell>{c.name}</TableCell>
                <TableCell>{c.category?.label ?? "—"}</TableCell>
                <TableCell>{c.workload ? `${c.workload} hs` : "—"}</TableCell>
                <TableCell><Badge variant="secondary">{c._count.instances}</Badge></TableCell>
                <TableCell className="text-right">
                  {!deleted && (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => editCourse(c.id)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={async () => {
                        if (!confirm("¿Eliminar el curso? Si tiene instancias activas, se eliminarán también.")) return;
                        await del.mutateAsync({ id: c.id, confirmCascade: true });
                      }}><Trash2 className="h-4 w-4" /></Button>
                    </>
                  )}
                  {deleted && canRestore && (
                    <Button variant="outline" size="sm" onClick={() => restore.mutate({ id: c.id })}>Restaurar</Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(empty); } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar" : "Nuevo"} curso</DialogTitle>
            <DialogDescription>Plantilla del curso. Las instancias se crean luego en Cronograma.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Sigla (3-6)</Label>
              <Input value={form.abbr} maxLength={6} onChange={(e) => setForm({ ...form, abbr: e.target.value })} />
            </div>
            <div>
              <Label>Carga horaria</Label>
              <Input value={form.workload} type="number" onChange={(e) => setForm({ ...form, workload: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Nombre</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Regla STCW (optativo)</Label>
              <Input
                value={form.stcwRule}
                maxLength={160}
                placeholder="Ej.: A-VI/1, A-VI/2-1, …"
                onChange={(e) => setForm({ ...form, stcwRule: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>Categoría</Label>
              <Select value={form.categoryId ?? "_"} onValueChange={(v) => setForm({ ...form, categoryId: v === "_" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">Sin categoría</SelectItem>
                  {cats.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Objetivos</Label>
              <Textarea value={form.objectives} onChange={(e) => setForm({ ...form, objectives: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Programa (opcional)</Label>
              <Textarea value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Requisitos de documentación (HU2-3)</Label>
              <div className="grid grid-cols-2 gap-2 mt-2 max-h-40 overflow-auto">
                {tipos.data?.map((t) => {
                  const checked = form.requisiteTipoIds.includes(t.id);
                  return (
                    <label key={t.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={checked} onCheckedChange={(v) => {
                        setForm((s) => ({
                          ...s,
                          requisiteTipoIds: v ? [...s.requisiteTipoIds, t.id] : s.requisiteTipoIds.filter((x) => x !== t.id),
                        }));
                      }} />
                      <span>{t.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            {editingId && (
              <div className="col-span-2 flex items-center gap-2">
                <Checkbox checked={form.propagateToInstances} onCheckedChange={(v) => setForm({ ...form, propagateToInstances: !!v })} />
                <span className="text-sm">Replicar cambios en todas las instancias existentes (HU7-3)</span>
              </div>
            )}
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
    </div>
  );
}
