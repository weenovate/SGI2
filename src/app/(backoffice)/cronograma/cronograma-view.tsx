"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Clock, FileSpreadsheet, Lock, LockOpen, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { CountPill } from "@/components/count-pill";
import { api, type RouterOutputs } from "@/lib/trpc/react";
import { toast } from "@/lib/toast";
import { useConfirm } from "@/components/confirm-dialog";
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

const modalityLabel: Record<Modality, string> = {
  virtual: "Virtual",
  presencial: "Presencial",
  hibrido: "Híbrida",
};
const modalityBadge: Record<Modality, "info" | "success" | "warning"> = {
  virtual: "info",
  presencial: "success",
  hibrido: "warning",
};

const typeLabel: Record<CourseType, string> = {
  completo: "Completo",
  actualizacion: "Actualización",
  completo_y_actualizacion: "Completo + Actualización",
};
// `default` (primary), `info` (cyan), `warning` (amber). Tres colores distintos.
const typeBadge: Record<CourseType, "default" | "info" | "warning"> = {
  completo: "default",
  actualizacion: "info",
  completo_y_actualizacion: "warning",
};

export function CronogramaView({ canRestore }: { canRestore: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [error, setError] = useState<string | null>(null);
  const [seeEnrollmentsFor, setSeeEnrollmentsFor] = useState<{ id: string; label: string } | null>(null);

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
  const setOpenClosed = api.instances.setEnrollmentOpen.useMutation({
    onSuccess: () => utils.instances.list.invalidate(),
  });
  const { confirm, dialog: confirmDialog } = useConfirm();

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

  async function toggleOpenClosed(id: string, currentClosed: boolean, label: string) {
    const closing = !currentClosed;
    const ok = await confirm({
      title: closing ? "Cerrar inscripciones" : "Reabrir inscripciones",
      description: closing
        ? `Vas a cerrar las inscripciones de ${label}. Nadie más va a poder anotarse hasta que la reabras.`
        : `Vas a reabrir las inscripciones de ${label}.`,
      confirmLabel: closing ? "Cerrar inscripciones" : "Reabrir",
      variant: closing ? "destructive" : "default",
    });
    if (!ok) return;
    try {
      await setOpenClosed.mutateAsync({ id, closed: closing });
      toast.success(closing ? "Inscripciones cerradas" : "Inscripciones reabiertas");
    } catch (e) {
      toast.error("No se pudo actualizar", e instanceof Error ? e.message : undefined);
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
            <TableHead className="min-w-[300px]">Instancia</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Cierre</TableHead>
            <TableHead>Inicio</TableHead>
            <TableHead>Fin</TableHead>
            <TableHead className="min-w-[180px]">Insc./Vac.</TableHead>
            <TableHead>Waitlist</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.isLoading && <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Cargando…</TableCell></TableRow>}
          {list.data?.items.map((it) => (
            <CronogramaRow
              key={it.id}
              it={it}
              deleted={!!it.deletedAt}
              canRestore={canRestore}
              onEdit={() => { setEditingId(it.id); setOpen(true); }}
              onDelete={async () => {
                const ok = await confirm({
                  title: "¿Eliminar instancia?",
                  description: `Vas a eliminar ${it.course.abbr} ${it.edition} — ${it.course.name}. Es soft-delete: se puede restaurar.`,
                  variant: "destructive",
                  confirmLabel: "Eliminar",
                });
                if (!ok) return;
                try { await del.mutateAsync({ id: it.id }); toast.success("Instancia eliminada"); }
                catch (e) { toast.error("No se pudo eliminar", e instanceof Error ? e.message : undefined); }
              }}
              onRestore={() => restore.mutate({ id: it.id })}
              onSeeEnrollments={() => setSeeEnrollmentsFor({ id: it.id, label: `${it.course.abbr} ${it.edition} — ${it.course.name}` })}
              onToggleOpen={() => toggleOpenClosed(it.id, it.enrollmentClosed, `${it.course.abbr} ${it.edition}`)}
              toggleBusy={setOpenClosed.isPending}
            />
          ))}
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

      <EnrollmentsForInstanceDialog
        target={seeEnrollmentsFor}
        onClose={() => setSeeEnrollmentsFor(null)}
      />
      {confirmDialog}
    </div>
  );
}

type Row = RouterOutputs["instances"]["list"]["items"][number];

function CronogramaRow({
  it,
  deleted,
  canRestore,
  onEdit,
  onDelete,
  onRestore,
  onSeeEnrollments,
  onToggleOpen,
  toggleBusy,
}: {
  it: Row;
  deleted: boolean;
  canRestore: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onSeeEnrollments: () => void;
  onToggleOpen: () => void;
  toggleBusy: boolean;
}) {
  const taken = it._count.enrollments;
  const total = it.vacancies;
  const pct = total === 0 ? 100 : Math.min(100, Math.round((taken / total) * 100));
  const free = Math.max(0, total - taken);

  const closeAt = new Date(it.startDate.getTime() - it.hoursBeforeClose * 3600_000);
  const hoursToClose = (closeAt.getTime() - Date.now()) / 3_600_000;
  // Estado real: cerrada cuando (a) el admin la cerró manualmente,
  // (b) se agotaron las vacantes o (c) la fecha de cierre ya pasó.
  // "Cierra pronto" es solo un label informativo cuando la instancia
  // está abierta y el cierre está dentro de las próximas 48hs.
  const isFull = total > 0 && free === 0;
  const closeAtPassed = hoursToClose <= 0;
  const isClosed = it.enrollmentClosed || isFull || closeAtPassed;
  const isOpen = !isClosed;
  const isClosingSoon = isOpen && hoursToClose > 0 && hoursToClose <= 48;
  const teacherName = it.teacher ? `${it.teacher.user.firstName ?? ""} ${it.teacher.user.lastName ?? ""}`.trim() : "";
  const araHref = `/api/cronograma/${it.id}/ara.xlsx`;

  return (
    <TableRow className={deleted ? "deleted-row" : undefined}>
      <TableCell>
        <div className="font-medium">
          <span className="font-mono">{it.course.abbr} {it.edition}</span>
          <span className="text-muted-foreground"> | </span>
          {it.course.name}
        </div>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <span className="text-xs text-muted-foreground">{teacherName || "Sin docente"}</span>
          <Badge variant={modalityBadge[it.modality as Modality]} className="text-[10px] py-0 px-1.5">
            {modalityLabel[it.modality as Modality]}
          </Badge>
          <Badge variant={typeBadge[it.type as CourseType]} className="text-[10px] py-0 px-1.5">
            {typeLabel[it.type as CourseType]}
          </Badge>
        </div>
      </TableCell>
      <TableCell>
        {isClosed
          ? <Badge variant="destructive">Cerrada</Badge>
          : isClosingSoon
            ? <Badge variant="warning">Cierra pronto</Badge>
            : <Badge variant="success">Abierta</Badge>}
      </TableCell>
      <TableCell className="text-sm whitespace-nowrap">{closeAt.toLocaleDateString("es-AR")}</TableCell>
      <TableCell className="text-sm whitespace-nowrap">{it.startDate.toLocaleDateString("es-AR")}</TableCell>
      <TableCell className="text-sm whitespace-nowrap">{it.endDate.toLocaleDateString("es-AR")}</TableCell>
      <TableCell>
        <CapacityBar taken={taken} total={total} pct={pct} free={free} />
      </TableCell>
      <TableCell>
        {it.waitlistEnabled
          ? <Badge variant="info">Activa ({it._count.waitlistEntries})</Badge>
          : <Badge variant="outline">—</Badge>}
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        {!deleted && (
          <>
            {isClosed ? (
              <a href={araHref} download>
                <Button variant="ghost" size="icon" title="Descargar planilla ARA (Excel)">
                  <FileSpreadsheet className="h-4 w-4" />
                </Button>
              </a>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                disabled
                title="Solo disponible cuando la instancia está cerrada"
              >
                <FileSpreadsheet className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onSeeEnrollments} title="Ver inscripciones">
              <Users className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleOpen}
              disabled={toggleBusy}
              title={it.enrollmentClosed ? "Reabrir inscripciones" : "Cerrar inscripciones"}
            >
              {it.enrollmentClosed ? <LockOpen className="h-4 w-4 text-success" /> : <Lock className="h-4 w-4" />}
            </Button>
            {it.waitlistEnabled && (
              <Link href={`/cronograma/${it.id}/lista-espera`}>
                <Button variant="ghost" size="icon" title="Lista de espera"><Clock className="h-4 w-4" /></Button>
              </Link>
            )}
            <Button variant="ghost" size="icon" onClick={onEdit} title="Editar"><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={onDelete} title="Eliminar"><Trash2 className="h-4 w-4" /></Button>
          </>
        )}
        {deleted && canRestore && <Button variant="outline" size="sm" onClick={onRestore}>Restaurar</Button>}
      </TableCell>
    </TableRow>
  );
}

// ProgressBar de capacidad con 3 zonas (verde/naranja/rojo) según %.
function CapacityBar({ taken, total, pct, free }: { taken: number; total: number; pct: number; free: number }) {
  const color =
    pct < 70 ? "bg-success" :
    pct < 100 ? "bg-warning" :
    "bg-destructive";
  return (
    <div className="space-y-1" title={`${pct}% completo — ${free} vacante${free === 1 ? "" : "s"} disponible${free === 1 ? "" : "s"}`}>
      <div className="flex justify-between text-xs font-mono tabular-nums">
        <span>{taken}/{total}</span>
        <span className="text-muted-foreground">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
    </div>
  );
}

const enrollmentStatusLabel: Record<string, string> = {
  preinscripto: "Preinscripto",
  validar_pago: "Validar pago",
  inscripto: "Inscripto",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
  lista_espera: "Lista de espera",
};
const enrollmentStatusBadge: Record<string, "info" | "warning" | "success" | "destructive" | "secondary"> = {
  preinscripto: "info",
  validar_pago: "warning",
  inscripto: "success",
  rechazado: "destructive",
  cancelado: "secondary",
  lista_espera: "secondary",
};

function EnrollmentsForInstanceDialog({
  target,
  onClose,
}: {
  target: { id: string; label: string } | null;
  onClose: () => void;
}) {
  const q = api.instances.enrollmentsForInstance.useQuery(
    { instanceId: target?.id ?? "" },
    { enabled: !!target },
  );
  const items = useMemo(() => q.data ?? [], [q.data]);

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Inscripciones — {target?.label}</DialogTitle>
          <DialogDescription>
            {items.length} {items.length === 1 ? "inscripción" : "inscripciones"}.
          </DialogDescription>
        </DialogHeader>
        {q.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {!q.isLoading && items.length === 0 && <p className="text-sm text-muted-foreground">Sin inscripciones todavía.</p>}
        {items.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Alumno</TableHead>
                <TableHead>DNI</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.code}</TableCell>
                  <TableCell>{e.student.firstName} {e.student.lastName}</TableCell>
                  <TableCell className="font-mono text-xs">{e.student.studentProfile?.docNumber ?? "—"}</TableCell>
                  <TableCell className="text-xs">{e.student.email}</TableCell>
                  <TableCell>
                    <Badge variant={enrollmentStatusBadge[e.status] ?? "secondary"}>
                      {enrollmentStatusLabel[e.status] ?? e.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
