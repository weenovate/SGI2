"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/trpc/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AttendanceStatus = "presente" | "ausente" | "justificado" | "tarde";

export function InstanceTeacher({ instanceId }: { instanceId: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/mis-cursos"><Button variant="ghost"><ArrowLeft className="h-4 w-4" /> Volver</Button></Link>
      </div>

      <Tabs defaultValue="alumnos">
        <TabsList>
          <TabsTrigger value="alumnos">Alumnos</TabsTrigger>
          <TabsTrigger value="asistencia">Asistencia</TabsTrigger>
          <TabsTrigger value="calificaciones">Calificaciones</TabsTrigger>
        </TabsList>
        <TabsContent value="alumnos"><AlumnosTab instanceId={instanceId} /></TabsContent>
        <TabsContent value="asistencia"><AsistenciaTab instanceId={instanceId} /></TabsContent>
        <TabsContent value="calificaciones"><CalificacionesTab instanceId={instanceId} /></TabsContent>
      </Tabs>
    </div>
  );
}

function AlumnosTab({ instanceId }: { instanceId: string }) {
  const list = api.teachers.alumnosForInstance.useQuery({ instanceId });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Alumnos inscriptos</CardTitle>
        <CardDescription>Datos de contacto. {list.data?.length ?? 0} alumno(s).</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>DNI</TableHead>
              <TableHead>Apellido y nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Calificación</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Cargando…</TableCell></TableRow>}
            {!list.isLoading && (list.data?.length ?? 0) === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Sin alumnos inscriptos.</TableCell></TableRow>}
            {list.data?.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="font-mono">{e.student.studentProfile?.docNumber ?? "—"}</TableCell>
                <TableCell>{e.student.lastName}, {e.student.firstName}</TableCell>
                <TableCell>{e.student.email}</TableCell>
                <TableCell>{e.student.studentProfile?.phone ?? "—"}</TableCell>
                <TableCell>
                  {e.grade
                    ? <Badge variant={e.grade.approved === false ? "destructive" : "success"}>{e.grade.score?.toString() ?? (e.grade.approved ? "Aprobado" : "Desaprobado")}</Badge>
                    : <Badge variant="outline">Sin calificar</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AsistenciaTab({ instanceId }: { instanceId: string }) {
  const utils = api.useUtils();
  const sessions = api.classes.list.useQuery({ instanceId });
  const summary = api.classes.summary.useQuery({ instanceId });
  const alumnos = api.teachers.alumnosForInstance.useQuery({ instanceId });
  const create = api.classes.create.useMutation({ onSuccess: () => { utils.classes.list.invalidate(); utils.classes.summary.invalidate(); } });
  const remove = api.classes.remove.useMutation({ onSuccess: () => { utils.classes.list.invalidate(); utils.classes.summary.invalidate(); } });
  const setAttendance = api.classes.setAttendance.useMutation({ onSuccess: () => { utils.classes.list.invalidate(); utils.classes.summary.invalidate(); } });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), topic: "" });
  const [active, setActive] = useState<string | null>(null);

  const activeSession = sessions.data?.find((s) => s.id === active);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Asistencia por clase</CardTitle>
            <CardDescription>Sumá clases y marcá presente/ausente por alumno.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nueva clase</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="border rounded-md p-2 space-y-1 max-h-72 overflow-auto">
            <p className="text-xs font-medium mb-1">Clases ({sessions.data?.length ?? 0})</p>
            {sessions.data?.length === 0 && <p className="text-xs text-muted-foreground">Sin clases todavía.</p>}
            {sessions.data?.map((s) => (
              <div key={s.id} className={`p-2 rounded cursor-pointer flex items-center justify-between text-sm ${active === s.id ? "bg-slate-100" : "hover:bg-slate-50"}`} onClick={() => setActive(s.id)}>
                <div>
                  <div>{new Date(s.date).toLocaleDateString("es-AR")}</div>
                  {s.topic && <div className="text-xs text-muted-foreground">{s.topic}</div>}
                </div>
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); if (confirm("¿Eliminar clase?")) remove.mutate({ id: s.id }); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="lg:col-span-2">
            {!active && <p className="text-sm text-muted-foreground">Elegí una clase para marcar asistencia.</p>}
            {active && activeSession && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Alumno</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alumnos.data?.map((e) => {
                    const att = activeSession.attendances.find((a) => a.enrollmentId === e.id);
                    return (
                      <TableRow key={e.id}>
                        <TableCell>{e.student.lastName}, {e.student.firstName}</TableCell>
                        <TableCell>
                          <Select
                            value={att?.status ?? "_"}
                            onValueChange={(v) => v !== "_" && setAttendance.mutate({ classSessionId: activeSession.id, enrollmentId: e.id, status: v as AttendanceStatus })}
                          >
                            <SelectTrigger className="w-40"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="presente">Presente</SelectItem>
                              <SelectItem value="ausente">Ausente</SelectItem>
                              <SelectItem value="justificado">Justificado</SelectItem>
                              <SelectItem value="tarde">Tarde</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        {summary.data && summary.data.rows.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Resumen ({summary.data.rows[0]?.totalSessions ?? 0} clases — mínimo {summary.data.minPercent}%)</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alumno</TableHead>
                  <TableHead>Presentes</TableHead>
                  <TableHead>%</TableHead>
                  <TableHead>Cumple mínimo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.data.rows.map((r) => (
                  <TableRow key={r.enrollmentId}>
                    <TableCell>{r.studentName}</TableCell>
                    <TableCell>{r.presentCount} / {r.totalSessions}</TableCell>
                    <TableCell>{r.percent ?? "—"}{r.percent != null && "%"}</TableCell>
                    <TableCell>{r.meetsMinimum == null ? "—" : r.meetsMinimum ? <Badge variant="success">Sí</Badge> : <Badge variant="destructive">No</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva clase</DialogTitle></DialogHeader>
          <Label>Fecha</Label>
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Label>Tema (opcional)</Label>
          <Input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={async () => {
              await create.mutateAsync({ instanceId, date: new Date(form.date), topic: form.topic || undefined });
              setOpen(false);
              setForm({ date: new Date().toISOString().slice(0, 10), topic: "" });
            }} disabled={create.isPending}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function CalificacionesTab({ instanceId }: { instanceId: string }) {
  const utils = api.useUtils();
  const settings = api.settings.list.useQuery({ category: "asistencia" });
  const alumnos = api.teachers.alumnosForInstance.useQuery({ instanceId });
  const upsert = api.grades.upsert.useMutation({ onSuccess: () => utils.teachers.alumnosForInstance.invalidate() });

  const scale = (settings.data?.find((s) => s.key === "attendance.gradeScale")?.value as string) ?? "numeric_1_10";
  const minPassing = (settings.data?.find((s) => s.key === "attendance.minPassingGrade")?.value as number) ?? 6;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Calificaciones</CardTitle>
        <CardDescription>
          Escala: <strong>{scale}</strong>{scale === "numeric_1_10" && ` (mínimo para aprobar: ${minPassing})`}.
          Al guardar se notifica al alumno por email + in-app.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Alumno</TableHead>
              <TableHead>Nota (1-10)</TableHead>
              <TableHead>Aprobado</TableHead>
              <TableHead>Notas</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alumnos.isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Cargando…</TableCell></TableRow>}
            {alumnos.data?.map((e) => (
              <GradeRow
                key={e.id}
                enrollmentId={e.id}
                studentName={`${e.student.lastName}, ${e.student.firstName}`}
                grade={e.grade}
                scale={scale}
                minPassing={minPassing}
                onSave={(data) => upsert.mutate({ enrollmentId: e.id, ...data })}
                busy={upsert.isPending}
              />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function GradeRow({ enrollmentId, studentName, grade, scale, minPassing, onSave, busy }: {
  enrollmentId: string;
  studentName: string;
  grade: { score: { toString: () => string } | null; approved: boolean | null; notes: string | null } | null;
  scale: string;
  minPassing: number;
  onSave: (data: { score: number | null; approved: boolean | null; notes?: string }) => void;
  busy: boolean;
}) {
  const [score, setScore] = useState(grade?.score?.toString() ?? "");
  const [notes, setNotes] = useState(grade?.notes ?? "");
  const [approved, setApproved] = useState<"_" | "yes" | "no">(
    grade?.approved == null ? "_" : grade.approved ? "yes" : "no",
  );

  return (
    <TableRow>
      <TableCell>{studentName}</TableCell>
      <TableCell>
        {scale === "numeric_1_10" ? (
          <Input type="number" min={0} max={10} step={0.1} value={score} onChange={(e) => setScore(e.target.value)} className="w-24" />
        ) : <span className="text-muted-foreground text-xs">N/A</span>}
      </TableCell>
      <TableCell>
        <Select value={approved} onValueChange={(v) => setApproved(v as typeof approved)}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_">—</SelectItem>
            <SelectItem value="yes">Aprobado</SelectItem>
            <SelectItem value="no">Desaprobado</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones" /></TableCell>
      <TableCell className="text-right">
        <Button size="sm" onClick={() => {
          const n = score ? Number(score) : null;
          let apr: boolean | null = approved === "yes" ? true : approved === "no" ? false : null;
          if (apr == null && scale === "numeric_1_10" && n != null) apr = n >= minPassing;
          onSave({ score: n, approved: apr, notes: notes || undefined });
        }} disabled={busy}>Guardar</Button>
      </TableCell>
    </TableRow>
  );
}
