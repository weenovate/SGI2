"use client";
import { useState } from "react";
import { Check, Search, X } from "lucide-react";
import { api } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CountPill } from "@/components/count-pill";

export function DocsBackoffice() {
  const [tab, setTab] = useState<"pendiente" | "aprobada" | "rechazada" | "vencida">("pendiente");
  const [q, setQ] = useState("");
  const totalAll = api.documents.list.useQuery({});
  const totalTab = api.documents.list.useQuery({ status: tab });
  const totalFiltered = api.documents.list.useQuery({ status: tab, q: q || undefined });
  const hasFilter = !!q;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            Documentación
            <CountPill
              total={totalAll.data?.total}
              filtered={hasFilter ? totalFiltered.data?.total : totalTab.data?.total}
              loading={totalAll.isLoading}
            />
          </h1>
          <p className="text-sm text-muted-foreground">Cola de aprobación / rechazo (HU11).</p>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Alumno o documento…" className="pl-8 w-72" />
        </div>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="pendiente">Pendientes</TabsTrigger>
          <TabsTrigger value="aprobada">Aprobadas</TabsTrigger>
          <TabsTrigger value="rechazada">Rechazadas</TabsTrigger>
          <TabsTrigger value="vencida">Vencidas</TabsTrigger>
        </TabsList>
        <TabsContent value={tab}><DocsTable status={tab} q={q} /></TabsContent>
      </Tabs>
    </div>
  );
}

function DocsTable({ status, q }: { status: "pendiente" | "aprobada" | "rechazada" | "vencida"; q: string }) {
  const utils = api.useUtils();
  const list = api.documents.list.useQuery({ status, q: q || undefined });
  const motivos = api.motivos.doc.list.useQuery();
  const approve = api.documents.approve.useMutation({ onSuccess: () => utils.documents.list.invalidate() });
  const reject = api.documents.reject.useMutation({ onSuccess: () => utils.documents.list.invalidate() });
  const [rejectOpen, setRejectOpen] = useState<string | null>(null);
  const [motivoId, setMotivoId] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Subido</TableHead>
            <TableHead>Alumno</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Vencimiento</TableHead>
            <TableHead>Archivos</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.data?.items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sin registros.</TableCell></TableRow>}
          {list.data?.items.map((d) => (
            <TableRow key={d.id}>
              <TableCell>{new Date(d.uploadedAt).toLocaleString("es-AR")}</TableCell>
              <TableCell>{d.student.user.lastName}, {d.student.user.firstName}<div className="text-xs text-muted-foreground">{d.student.docNumber}</div></TableCell>
              <TableCell>{d.tipo.label}</TableCell>
              <TableCell>{d.expiresAt ? new Date(d.expiresAt).toLocaleDateString("es-AR") : "—"}{d.expiringSoon && <Badge variant="info" className="ml-2">vence pronto</Badge>}</TableCell>
              <TableCell>
                <div className="flex gap-1 flex-wrap">
                  {d.files.map((f) => (
                    <a key={f.id} href={`/api/files/${f.fileObject.relPath}`} target="_blank" rel="noreferrer">
                      <Badge variant="outline" className="cursor-pointer">{f.fileObject.originalName}</Badge>
                    </a>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-right">
                {status === "pendiente" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => approve.mutate({ id: d.id })}><Check className="h-4 w-4" /> Aprobar</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setRejectOpen(d.id); setMotivoId(""); setNotes(""); }}><X className="h-4 w-4" /> Rechazar</Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!rejectOpen} onOpenChange={(v) => !v && setRejectOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rechazar documentación</DialogTitle></DialogHeader>
          <Label>Motivo (Anexo H)</Label>
          <Select value={motivoId || "_"} onValueChange={(v) => setMotivoId(v === "_" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Elegir motivo…" /></SelectTrigger>
            <SelectContent>
              {motivos.data?.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Label>Notas (opcional)</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Detalle adicional…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={async () => {
              if (!rejectOpen || !motivoId) return;
              await reject.mutateAsync({ id: rejectOpen, motivoId, notes: notes || undefined });
              setRejectOpen(null);
            }} disabled={!motivoId}>
              Rechazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
