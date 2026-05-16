"use client";
import { useMemo, useState } from "react";
import { Search, Upload, X } from "lucide-react";
import { api } from "@/lib/trpc/react";
import { toast } from "@/lib/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConfirm } from "@/components/confirm-dialog";

const statusVariant: Record<string, "default" | "secondary" | "warning" | "success" | "destructive" | "info" | "outline"> = {
  preinscripto: "info",
  validar_pago: "warning",
  inscripto: "success",
  rechazado: "destructive",
  cancelado: "secondary",
  lista_espera: "secondary",
};

const statusLabel: Record<string, string> = {
  preinscripto: "Preinscripto",
  validar_pago: "Realizar pago",
  inscripto: "Inscripto",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
  lista_espera: "Lista de espera",
};

export function MyEnrollments() {
  const utils = api.useUtils();
  const list = api.enrollments.myList.useQuery();
  const cancel = api.enrollments.cancel.useMutation({ onSuccess: () => utils.enrollments.myList.invalidate() });
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [payOpen, setPayOpen] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return (list.data ?? []).filter((e) => {
      if (statusFilter && e.status !== statusFilter) return false;
      if (q) {
        const text = `${e.instance.course.name} ${e.instance.course.abbr} ${e.code}`.toLowerCase();
        if (!text.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [list.data, q, statusFilter]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Mis inscripciones</CardTitle>
          <CardDescription>Podés cancelar las que aún no estén cerradas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" placeholder="Curso, sigla o código" />
              </div>
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={statusFilter || "_"} onValueChange={(v) => setStatusFilter(v === "_" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">Todos</SelectItem>
                  {Object.entries(statusLabel).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Sigla</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Cargando…</TableCell></TableRow>}
              {!list.isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Sin inscripciones para los filtros.</TableCell></TableRow>}
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.code}</TableCell>
                  <TableCell className="font-mono">{e.instance.course.abbr} {e.instance.edition}</TableCell>
                  <TableCell>{e.instance.course.name}</TableCell>
                  <TableCell>{new Date(e.instance.startDate).toLocaleDateString("es-AR")}</TableCell>
                  <TableCell>{new Date(e.instance.endDate).toLocaleDateString("es-AR")}</TableCell>
                  <TableCell><Badge variant={statusVariant[e.status]}>{statusLabel[e.status]}</Badge></TableCell>
                  <TableCell className="text-right">
                    {e.status === "validar_pago" && (
                      <Button size="sm" variant="outline" onClick={() => setPayOpen(e.id)}>
                        <Upload className="h-4 w-4" /> Subir comprobante
                      </Button>
                    )}
                    {(e.status === "preinscripto" || e.status === "validar_pago") && (
                      <Button size="sm" variant="ghost" onClick={async () => {
                        const ok = await confirm({
                          title: "¿Cancelar inscripción?",
                          description: `Vas a cancelar tu inscripción a ${e.instance.course.name} (${e.code}). Esta acción se puede revertir solo volviendo a inscribirte.`,
                          variant: "destructive",
                          confirmLabel: "Cancelar inscripción",
                        });
                        if (!ok) return;
                        try { await cancel.mutateAsync({ id: e.id }); toast.success("Inscripción cancelada"); }
                        catch (err) { toast.error("No se pudo cancelar", err instanceof Error ? err.message : undefined); }
                      }}>
                        <X className="h-4 w-4" /> Cancelar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {payOpen && (
        <PaymentDialog
          enrollmentId={payOpen}
          onClose={() => setPayOpen(null)}
          onDone={() => { setPayOpen(null); utils.enrollments.myList.invalidate(); }}
        />
      )}
      {confirmDialog}
    </div>
  );
}

type OcrPaymentResult = {
  medio: string | null;
  fechaPago: string | null;
  monto: string | null;
  numeroOperacion: string | null;
  score: number;
  rawText: string;
};

function PaymentDialog({ enrollmentId, onClose, onDone }: { enrollmentId: string; onClose: () => void; onDone: () => void }) {
  const state = api.payments.inscripcionState.useQuery({ enrollmentId });
  const myPays = api.payments.myList.useQuery({ enrollmentId });
  const create = api.payments.myCreate.useMutation();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<{ id: string; originalName: string } | null>(null);
  const [ocr, setOcr] = useState<OcrPaymentResult | null>(null);
  const [form, setForm] = useState({ medio: "", fechaPago: "", monto: "", numeroOperacion: "" });

  async function handleUpload(files: FileList) {
    setBusy(true); setError(null);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("files", f));
      const res = await fetch("/api/upload?bucket=payments", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const j = (await res.json()) as { files: Array<{ id: string; originalName: string; paymentOcr?: OcrPaymentResult }> };
      const f = j.files[0];
      if (!f) throw new Error("Sin archivo");
      setFile({ id: f.id, originalName: f.originalName });
      if (f.paymentOcr) {
        setOcr(f.paymentOcr);
        setForm({
          medio: f.paymentOcr.medio ?? "",
          fechaPago: f.paymentOcr.fechaPago ? new Date(f.paymentOcr.fechaPago).toISOString().slice(0, 10) : "",
          monto: f.paymentOcr.monto ?? "",
          numeroOperacion: f.paymentOcr.numeroOperacion ?? "",
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Subir comprobante de pago</DialogTitle>
          <DialogDescription>
            {state.data?.canUpload ? "Subí el comprobante (PDF/JPG/PNG hasta 10 MB). Vamos a pre-leer los datos con OCR." : "Esta inscripción no admite carga de comprobante en este momento."}
          </DialogDescription>
        </DialogHeader>

        {state.data?.bankInfo && (state.data.bankInfo as { cbu?: string; alias?: string; titular?: string }).cbu && (
          <div className="text-xs border rounded-md p-2 bg-slate-50">
            <p className="font-medium mb-1">Datos para transferencia:</p>
            <p>CBU: {(state.data.bankInfo as { cbu?: string }).cbu}</p>
            <p>Alias: {(state.data.bankInfo as { alias?: string }).alias}</p>
            <p>Titular: {(state.data.bankInfo as { titular?: string }).titular}</p>
          </div>
        )}

        <div>
          <Label>Archivo</Label>
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            disabled={busy || !state.data?.canUpload}
            onChange={(e) => e.target.files && handleUpload(e.target.files)}
          />
          {file && <p className="text-xs text-muted-foreground mt-1">Cargado: {file.originalName}</p>}
        </div>

        {file && (
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label>Medio de pago</Label>
              <Input value={form.medio} onChange={(e) => setForm({ ...form, medio: e.target.value })} placeholder="Transferencia, Mercado Pago, etc." />
            </div>
            <div><Label>Fecha</Label><Input type="date" value={form.fechaPago} onChange={(e) => setForm({ ...form, fechaPago: e.target.value })} /></div>
            <div><Label>Monto</Label><Input value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} placeholder="0.00" /></div>
            <div className="col-span-2"><Label>Nº de operación</Label><Input value={form.numeroOperacion} onChange={(e) => setForm({ ...form, numeroOperacion: e.target.value })} /></div>
            {ocr && (
              <p className="col-span-2 text-xs text-muted-foreground">OCR score: {ocr.score}/100. Revisá y corregí lo que haga falta.</p>
            )}
          </div>
        )}

        {myPays.data && myPays.data.length > 0 && (
          <div className="border-t pt-2 text-xs">
            <p className="font-medium">Comprobantes ya enviados:</p>
            <ul>
              {myPays.data.map((p) => (
                <li key={p.id}>
                  {new Date(p.uploadedAt).toLocaleString("es-AR")} — {p.approved ? "✅ Aprobado" : p.rejectedReason ? `❌ ${p.rejectedReason}` : "⏳ Pendiente"}
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!file || busy || create.isPending}
            onClick={async () => {
              if (!file) return;
              try {
                await create.mutateAsync({
                  enrollmentId,
                  fileObjectId: file.id,
                  medio: form.medio || null,
                  fechaPago: form.fechaPago ? new Date(form.fechaPago) : null,
                  monto: form.monto || null,
                  numeroOperacion: form.numeroOperacion || null,
                  ocrText: ocr?.rawText ?? null,
                  ocrScore: ocr?.score ?? null,
                });
                onDone();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Error");
              }
            }}
          >
            {create.isPending ? "Enviando…" : "Enviar comprobante"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
