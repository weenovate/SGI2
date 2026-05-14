"use client";
import { useRef, useState } from "react";
import { FileText, Plus, Trash2, Upload } from "lucide-react";
import { api } from "@/lib/trpc/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type UploadResult = { id: string; relPath: string; mime: string; originalName: string; size: number; warning?: string; quality?: { score: number } };

export function MyDocs() {
  const utils = api.useUtils();
  const list = api.documents.myList.useQuery();
  const tipos = api.tiposDocumentacion.list.useQuery();
  const create = api.documents.myCreate.useMutation({ onSuccess: () => utils.documents.myList.invalidate() });
  const replace = api.documents.myReplaceFiles.useMutation({ onSuccess: () => utils.documents.myList.invalidate() });
  const del = api.documents.myDelete.useMutation({ onSuccess: () => utils.documents.myList.invalidate() });
  const [open, setOpen] = useState<{ replaceId?: string } | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mi documentación</h1>
          <p className="text-sm text-muted-foreground">Subí PDF/JPG/PNG (hasta 15 MB).</p>
        </div>
        <Button onClick={() => setOpen({})}><Plus className="h-4 w-4" /> Subir nuevo documento</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.data?.length === 0 && <p className="col-span-3 text-muted-foreground">Aún no subiste documentación.</p>}
        {list.data?.map((d) => (
          <Card key={d.id}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> {d.tipo.label}</CardTitle>
              <CardDescription>
                Subido el {new Date(d.uploadedAt).toLocaleDateString("es-AR")}
                {d.expiresAt && (<><br />Vence: {new Date(d.expiresAt).toLocaleDateString("es-AR")}</>)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                {d.status === "aprobada" && <Badge variant="success">Aprobada</Badge>}
                {d.status === "pendiente" && <Badge variant="warning">Pendiente</Badge>}
                {d.status === "rechazada" && <Badge variant="destructive">Rechazada</Badge>}
                {d.status === "vencida" && <Badge variant="destructive">Vencida</Badge>}
                {d.expiringSoon && <Badge variant="info">Vence pronto</Badge>}
              </div>
              {d.rejectionNotes && <p className="text-xs text-destructive">Motivo: {d.rejectionNotes}</p>}
              <div className="flex gap-1 flex-wrap">
                {d.files.map((f) => (
                  <a key={f.id} href={`/api/files/${f.fileObject.relPath}`} target="_blank" rel="noreferrer">
                    <Badge variant="outline" className="cursor-pointer">{f.fileObject.originalName}</Badge>
                  </a>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => setOpen({ replaceId: d.id })}>
                  <Upload className="h-4 w-4" /> Reemplazar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm("¿Eliminar?")) del.mutate({ id: d.id }); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <UploadDialog
        open={!!open}
        onClose={() => setOpen(null)}
        replaceId={open?.replaceId}
        tipos={tipos.data ?? []}
        onCreate={async (tipoId, files, expiresAt) => { await create.mutateAsync({ tipoId, fileObjectIds: files, expiresAt }); }}
        onReplace={async (id, files, expiresAt) => { await replace.mutateAsync({ documentId: id, fileObjectIds: files, expiresAt }); }}
      />
    </div>
  );
}

function UploadDialog(props: {
  open: boolean;
  onClose: () => void;
  replaceId?: string;
  tipos: Array<{ id: string; label: string; hasExpiry: boolean }>;
  onCreate: (tipoId: string, files: string[], expiresAt: Date | null) => Promise<void>;
  onReplace: (id: string, files: string[], expiresAt: Date | null) => Promise<void>;
}) {
  const [tipoId, setTipoId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [uploaded, setUploaded] = useState<UploadResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const tipoSelected = props.tipos.find((t) => t.id === tipoId);

  async function handleUpload(files: FileList) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("files", f));
      const res = await fetch("/api/upload?bucket=documents", { method: "POST", body: fd });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      const j = (await res.json()) as { files: UploadResult[] };
      setUploaded((s) => [...s, ...j.files]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={(v) => { if (!v) props.onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.replaceId ? "Reemplazar archivos" : "Subir nuevo documento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!props.replaceId && (
            <div>
              <Label>Tipo de documentación</Label>
              <Select value={tipoId || "_"} onValueChange={(v) => setTipoId(v === "_" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Elegir…" /></SelectTrigger>
                <SelectContent>
                  {props.tipos.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {(tipoSelected?.hasExpiry || props.replaceId) && (
            <div>
              <Label>Fecha de vencimiento (opcional)</Label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
          )}
          <div>
            <Label>Archivos</Label>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(e) => e.target.files && handleUpload(e.target.files)}
            />
            <p className="text-xs text-muted-foreground mt-1">PDF/JPG/PNG hasta 15 MB. Para documentos con anverso y reverso, subí ambas imágenes.</p>
          </div>
          {uploaded.length > 0 && (
            <div className="border rounded-md p-2 space-y-1">
              {uploaded.map((u) => (
                <div key={u.id} className="text-xs flex items-center justify-between">
                  <span>{u.originalName} ({Math.round(u.size / 1024)} KB){u.quality && ` — score ${u.quality.score}`}</span>
                  {u.warning && <Badge variant="warning">{u.warning}</Badge>}
                </div>
              ))}
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={props.onClose}>Cancelar</Button>
          <Button
            disabled={busy || uploaded.length === 0 || (!props.replaceId && !tipoId)}
            onClick={async () => {
              try {
                const exp = expiresAt ? new Date(expiresAt) : null;
                if (props.replaceId) {
                  await props.onReplace(props.replaceId, uploaded.map((u) => u.id), exp);
                } else {
                  await props.onCreate(tipoId, uploaded.map((u) => u.id), exp);
                }
                setUploaded([]); setTipoId(""); setExpiresAt(""); props.onClose();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Error");
              }
            }}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
