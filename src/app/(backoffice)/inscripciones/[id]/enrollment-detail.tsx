"use client";
import Link from "next/link";
import { useState } from "react";
import { Check, X, ArrowLeft } from "lucide-react";
import { api } from "@/lib/trpc/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const statusLabel: Record<string, string> = {
  preinscripto: "Preinscripto",
  validar_pago: "Validar pago",
  inscripto: "Inscripto",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
  lista_espera: "Lista de espera",
};

export function EnrollmentDetail({ id }: { id: string }) {
  const utils = api.useUtils();
  const q = api.enrollments.byId.useQuery({ id });
  const motivos = api.motivos.inscripcion.list.useQuery();
  const approve = api.enrollments.approve.useMutation({ onSuccess: () => utils.enrollments.byId.invalidate() });
  const reject = api.enrollments.reject.useMutation({ onSuccess: () => { utils.enrollments.byId.invalidate(); setRejectOpen(false); } });
  const [rejectOpen, setRejectOpen] = useState(false);
  const [motivoId, setMotivoId] = useState("");
  const [notes, setNotes] = useState("");

  if (q.isLoading) return <p className="text-muted-foreground">Cargando…</p>;
  if (!q.data) return <p className="text-destructive">No encontrada.</p>;
  const e = q.data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/inscripciones"><Button variant="ghost"><ArrowLeft className="h-4 w-4" /> Volver</Button></Link>
        <div className="flex gap-2">
          {["preinscripto", "validar_pago"].includes(e.status) && (
            <Button onClick={() => approve.mutate({ id: e.id })} disabled={approve.isPending}><Check className="h-4 w-4" /> Aprobar</Button>
          )}
          {["preinscripto", "validar_pago"].includes(e.status) && (
            <Button variant="ghost" onClick={() => { setRejectOpen(true); setMotivoId(""); setNotes(""); }}><X className="h-4 w-4" /> Rechazar</Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <span className="font-mono text-base">{e.code}</span>
            <Badge className="ml-3">{statusLabel[e.status]}</Badge>
            {e.observed && <Badge variant="warning" className="ml-1">observada</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <p><strong>Curso:</strong> {e.instance.course.name} ({e.instance.course.abbr} {e.instance.edition})</p>
          <p><strong>Fechas:</strong> {new Date(e.instance.startDate).toLocaleDateString("es-AR")} → {new Date(e.instance.endDate).toLocaleDateString("es-AR")}</p>
          {e.instance.teacher && <p><strong>Docente:</strong> {e.instance.teacher.user.firstName} {e.instance.teacher.user.lastName}</p>}
          <p><strong>Pagador:</strong> {e.payer === "particular" ? "Particular" : "Empresa"}</p>
          {e.empresaSuggestion && <p><strong>Empresa sugerida:</strong> {e.empresaSuggestion} (pendiente)</p>}
        </CardContent>
      </Card>

      <Tabs defaultValue="alumno">
        <TabsList>
          <TabsTrigger value="alumno">Alumno</TabsTrigger>
          <TabsTrigger value="docs">Documentación (snapshot)</TabsTrigger>
          <TabsTrigger value="pagos">Pagos</TabsTrigger>
        </TabsList>

        <TabsContent value="alumno">
          <Card>
            <CardHeader><CardTitle className="text-base">Datos del alumno</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <p><strong>Nombre:</strong> {e.student.firstName} {e.student.lastName}</p>
              <p><strong>Email:</strong> {e.student.email}</p>
              <p><strong>DNI:</strong> {e.student.studentProfile?.docNumber ?? e.student.username}</p>
              {e.student.studentProfile?.phone && <p><strong>Teléfono:</strong> {e.student.studentProfile.phone}</p>}
              {e.student.studentProfile?.birthDate && <p><strong>Nacimiento:</strong> {new Date(e.student.studentProfile.birthDate).toLocaleDateString("es-AR")}</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="docs">
          <Card>
            <CardHeader><CardTitle className="text-base">Documentación al momento de inscribirse</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {e.snapshots.length === 0 && <p className="text-muted-foreground">Este curso no requería documentación.</p>}
              {e.snapshots.map((s) => {
                const ids = s.fileObjectIds.split(",").filter(Boolean);
                return (
                  <div key={s.id} className="border rounded-md p-2">
                    <p className="font-medium">{(s.data as { tipo?: string }).tipo ?? s.tipoDocumentacionId}</p>
                    <p className="text-xs text-muted-foreground">
                      Archivos: {ids.length} — snapshot del {new Date(s.takenAt).toLocaleString("es-AR")}
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pagos">
          <PaymentsPanel enrollmentId={e.id} />
        </TabsContent>
      </Tabs>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rechazar inscripción</DialogTitle></DialogHeader>
          <Label>Motivo (Anexo I)</Label>
          <Select value={motivoId || "_"} onValueChange={(v) => setMotivoId(v === "_" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Elegir motivo…" /></SelectTrigger>
            <SelectContent>
              {motivos.data?.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Label>Notas (opcional)</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button variant="destructive" disabled={!motivoId} onClick={() => reject.mutate({ id: e.id, motivoId, notes: notes || undefined })}>Rechazar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentsPanel({ enrollmentId }: { enrollmentId: string }) {
  const utils = api.useUtils();
  const list = api.payments.list.useQuery({ enrollmentId });
  const approve = api.payments.approve.useMutation({
    onSuccess: () => { utils.payments.list.invalidate(); utils.enrollments.byId.invalidate(); },
  });
  const reject = api.payments.reject.useMutation({ onSuccess: () => utils.payments.list.invalidate() });
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Comprobantes de pago</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        {list.isLoading && <p className="text-muted-foreground">Cargando…</p>}
        {!list.isLoading && (list.data?.length ?? 0) === 0 && <p className="text-muted-foreground">Sin comprobantes.</p>}
        {list.data?.map((p) => (
          <PaymentItem
            key={p.id}
            payment={p}
            busy={approve.isPending || reject.isPending}
            onApprove={(data) => approve.mutate({ id: p.id, ...data })}
            onReject={() => { setRejectFor(p.id); setReason(""); }}
          />
        ))}
      </CardContent>

      <Dialog open={!!rejectFor} onOpenChange={(v) => !v && setRejectFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rechazar comprobante</DialogTitle></DialogHeader>
          <Label>Motivo</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Comprobante ilegible, monto incorrecto, etc." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectFor(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={reason.length < 2} onClick={async () => {
              if (rejectFor) await reject.mutateAsync({ id: rejectFor, reason });
              setRejectFor(null);
            }}>Rechazar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function PaymentItem({ payment, busy, onApprove, onReject }: {
  payment: { id: string; medio: string | null; fechaPago: Date | null; monto: { toString: () => string } | null; numeroOperacion: string | null; ocrScore: number | null; approved: boolean; rejectedReason: string | null; fileObject: { relPath: string; originalName: string }; uploadedAt: Date };
  busy: boolean;
  onApprove: (data: { medio?: string | null; fechaPago?: Date | null; monto?: string | null; numeroOperacion?: string | null }) => void;
  onReject: () => void;
}) {
  const [form, setForm] = useState({
    medio: payment.medio ?? "",
    fechaPago: payment.fechaPago ? new Date(payment.fechaPago).toISOString().slice(0, 10) : "",
    monto: payment.monto ? payment.monto.toString() : "",
    numeroOperacion: payment.numeroOperacion ?? "",
  });
  const pending = !payment.approved && !payment.rejectedReason;

  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <a href={`/api/files/${payment.fileObject.relPath}`} target="_blank" rel="noreferrer" className="text-primary underline">
            {payment.fileObject.originalName}
          </a>
          <span className="text-xs text-muted-foreground ml-2">subido el {new Date(payment.uploadedAt).toLocaleString("es-AR")}</span>
        </div>
        <div>
          {payment.approved ? <Badge variant="success">Aprobado</Badge> :
            payment.rejectedReason ? <Badge variant="destructive">Rechazado</Badge> :
            <Badge variant="warning">Pendiente</Badge>}
          {payment.ocrScore != null && <Badge variant="outline" className="ml-1">OCR {payment.ocrScore}</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2"><Label>Medio</Label><Input value={form.medio} onChange={(e) => setForm({ ...form, medio: e.target.value })} disabled={!pending} /></div>
        <div><Label>Fecha</Label><Input type="date" value={form.fechaPago} onChange={(e) => setForm({ ...form, fechaPago: e.target.value })} disabled={!pending} /></div>
        <div><Label>Monto</Label><Input value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} disabled={!pending} /></div>
        <div className="col-span-2"><Label>Nº operación</Label><Input value={form.numeroOperacion} onChange={(e) => setForm({ ...form, numeroOperacion: e.target.value })} disabled={!pending} /></div>
      </div>

      {payment.rejectedReason && <p className="text-xs text-destructive">Motivo: {payment.rejectedReason}</p>}

      {pending && (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onReject} disabled={busy}>Rechazar</Button>
          <Button size="sm" onClick={() => onApprove({
            medio: form.medio || null,
            fechaPago: form.fechaPago ? new Date(form.fechaPago) : null,
            monto: form.monto || null,
            numeroOperacion: form.numeroOperacion || null,
          })} disabled={busy}>Aprobar pago</Button>
        </div>
      )}
    </div>
  );
}
