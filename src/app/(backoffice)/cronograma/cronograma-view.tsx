"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { CountPill } from "@/components/count-pill";
import { api } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type CourseType = "completo" | "actualizacion" | "completo_y_actualizacion";
type Modality = "virtual" | "presencial" | "hibrido";

type Form = {
  courseId: string;
  edition: string;
  type: CourseType;
  modality: Modality;
  startDate: string;
  endDate: string;
  startTime: string;
  teacherId: string | null;
  vacancies: string;
  hoursBeforeClose: string;
  waitlistEnabled: boolean;
  showVacancies: boolean;
};

function todayISO() { return new Date().toISOString().slice(0, 10); }

const empty: Form = {
  courseId: "",
  edition: new Date().getFullYear().toString().slice(-2) + "01",
  type: "completo",
  modality: "presencial",
  startDate: todayISO(),
  endDate: todayISO(),
  startTime: "09:00",
  teacherId: null,
  vacancies: "30",
  hoursBeforeClose: "24",
  waitlistEnabled: false,
  showVacancies: true,
};

export function CronogramaView({ canRestore }: { canRestore: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [error, setError] = useState<string | null>(null);

  const utils = api.useUtils();
  const courses = api.courses.list.useQuery({ pageSize: 200 });
  const teachers = api.teachers.list.useQuery();
  const settings = api.settings.list.useQuery({ category: "instancia" });
  const list = api.instances.list.useQuery({ q: q || undefined, includeDeleted: true });
  const totalAll = api.instances.list.useQuery({ includeDeleted: true });
  const byId = api.instances.byId.useQuery({ id: editingId ?? "" }, { enabled: !!editingId });
  const create = api.instances.create.useMutation({ onSuccess: () => { utils.instances.list.invalidate(); setOpen(false); setForm(empty); } });
  const update = api.instances.update.useMutation({ onSuccess: () => { utils.instances.list.invalidate(); setOpen(false); setForm(empty); } });
  const del = api.instances.softDelete.useMutation({ onSuccess: () => utils.instances.list.invalidate() });
  const restore = api.instances.restore.useMutation({ onSuccess: () => utils.instances.list.invalidate() });

  useEffect(() => {
    if (editingId && byId.data) {
      const i = byId.data;
      setForm({
        courseId: i.courseId,
        edition: String(i.edition),
        type: i.type as CourseType,
        modality: i.modality as Modality,
        startDate: i.startDate.toISOString().slice(0, 10),
        endDate: i.endDate.toISOString().slice(0, 10),
        startTime: i.startTime ?? "09:00",
        teacherId: i.teacherId ?? null,
        vacancies: String(i.vacancies),
        hoursBeforeClose: String(i.hoursBeforeClose),
        waitlistEnabled: i.waitlistEnabled,
        showVacancies: i.showVacancies,
      });
    }
  }, [editingId, byId.data]);

  function newOne() {
    setEditingId(null);
    const defaultVac = (settings.data?.find((s) => s.key === "instance.defaultVacancies")?.value as number) ?? 30;
    const defaultTime = (settings.data?.find((s) => s.key === "instance.defaultStartTime")?.value as string) ?? "09:00";
    setForm({ ...empty, vacancies: String(defaultVac), startTime: defaultTime });
    setError(null);
    setOpen(true);
  }

  async function submit() {
    setError(null);
    try {
      const payload = {
        courseId: form.courseId,
        edition: Number(form.edition),
        type: form.type,
        modality: form.modality,
        startDate: new Date(form.startDate),
        endDate: new Date(form.endDate),
        startTime: form.startTime,
        teacherId: form.teacherId,
        vacancies: Number(form.vacancies),
        hoursBeforeClose: Number(form.hoursBeforeClose),
        waitlistEnabled: form.waitlistEnabled,
        showVacancies: form.showVacancies,
      };
      if (editingId) await update.mutateAsync({ id: editingId, ...payload });
      else await create.mutateAsync(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            Cronograma
            <CountPill total={totalAll.data?.total} filtered={q ? list.data?.total : undefined} loading={list.isLoading || totalAll.isLoading} />
          </h1>
          <p className="text-sm text-muted-foreground">Instancias de cursos publicadas.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Curso o sigla…" className="pl-8 w-64" />
          </div>
          <Button onClick={newOne}><Plus className="h-4 w-4" /> Nueva</Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sigla + Edición</TableHead>
            <TableHead>Curso</TableHead>
            <TableHead>Modalidad</TableHead>
            <TableHead>Inicio</TableHead>
            <TableHead>Fin</TableHead>
            <TableHead>Docente</TableHead>
            <TableHead>Vac/Insc</TableHead>
            <TableHead>L.E.</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.isLoading && <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">Cargando…</TableCell></TableRow>}
          {list.data?.items.map((it) => {
            const deleted = !!it.deletedAt;
            return (
              <TableRow key={it.id} className={deleted ? "deleted-row" : undefined}>
                <TableCell className="font-mono">{it.course.abbr} {it.edition}</TableCell>
                <TableCell>{it.course.name}</TableCell>
                <TableCell><Badge variant="secondary">{it.modality}</Badge></TableCell>
                <TableCell>{it.startDate.toLocaleDateString("es-AR")}</TableCell>
                <TableCell>{it.endDate.toLocaleDateString("es-AR")}</TableCell>
                <TableCell>{it.teacher ? `${it.teacher.user.lastName}, ${it.teacher.user.firstName}` : "—"}</TableCell>
                <TableCell>{it.vacancies}/{it._count.enrollments}</TableCell>
                <TableCell>{it.waitlistEnabled ? <Badge variant="info">Activa ({it._count.waitlistEntries})</Badge> : <Badge variant="outline">—</Badge>}</TableCell>
                <TableCell className="text-right">
                  {!deleted && (
                    <>
                      {it.waitlistEnabled && (
                        <Link href={`/cronograma/${it.id}/lista-espera`}>
                          <Button variant="ghost" size="icon" title="Lista de espera"><Clock className="h-4 w-4" /></Button>
                        </Link>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => { setEditingId(it.id); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("¿Eliminar instancia?")) del.mutate({ id: it.id }); }}><Trash2 className="h-4 w-4" /></Button>
                    </>
                  )}
                  {deleted && canRestore && <Button variant="outline" size="sm" onClick={() => restore.mutate({ id: it.id })}>Restaurar</Button>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(empty); } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar" : "Nueva"} instancia</DialogTitle>
            <DialogDescription>Cronograma — instancia de un curso maestro.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Curso</Label>
              <Select value={form.courseId || "_"} onValueChange={(v) => setForm({ ...form, courseId: v === "_" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Elegir curso…" /></SelectTrigger>
                <SelectContent>
                  {courses.data?.items.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.abbr} — {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Edición</Label>
              <Input type="number" value={form.edition} onChange={(e) => setForm({ ...form, edition: e.target.value })} />
            </div>
            <div>
              <Label>Vacantes</Label>
              <Input type="number" value={form.vacancies} onChange={(e) => setForm({ ...form, vacancies: e.target.value })} />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as CourseType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="completo">Completo</SelectItem>
                  <SelectItem value="actualizacion">Actualización</SelectItem>
                  <SelectItem value="completo_y_actualizacion">Completo + Actualización</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Modalidad</Label>
              <Select value={form.modality} onValueChange={(v) => setForm({ ...form, modality: v as Modality })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="virtual">Virtual</SelectItem>
                  <SelectItem value="presencial">Presencial</SelectItem>
                  <SelectItem value="hibrido">Híbrida</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Inicio</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
            <div><Label>Fin</Label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
            <div><Label>Hora inicio</Label><Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
            <div><Label>Cierre inscripción (hs antes)</Label><Input type="number" value={form.hoursBeforeClose} onChange={(e) => setForm({ ...form, hoursBeforeClose: e.target.value })} /></div>
            <div className="col-span-2">
              <Label>Docente</Label>
              <Select value={form.teacherId ?? "_"} onValueChange={(v) => setForm({ ...form, teacherId: v === "_" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">Sin asignar</SelectItem>
                  {teachers.data?.map((t) => <SelectItem key={t.id} value={t.id}>{t.user.lastName}, {t.user.firstName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label>Lista de espera activa</Label>
              <Switch checked={form.waitlistEnabled} onCheckedChange={(v) => setForm({ ...form, waitlistEnabled: !!v })} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label>Mostrar vacantes al público</Label>
              <Switch checked={form.showVacancies} onCheckedChange={(v) => setForm({ ...form, showVacancies: !!v })} />
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
    </div>
  );
}
