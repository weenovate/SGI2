"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Image as ImageIcon, Plus, Trash2, Upload, UploadCloud, X } from "lucide-react";
import { api } from "@/lib/trpc/react";
import { toast } from "@/lib/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirm } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";

type DocFile = { id: string; mime: string; relPath: string; originalName: string; size: number };

type UploadResult = {
  id: string;
  relPath: string;
  mime: string;
  originalName: string;
  size: number;
  warning?: string;
  quality?: { score: number } | null;
  documentOcr?: {
    expiresAt: string | null;
    typeMatched: boolean;
    score: number;
  } | null;
  // Preview local (objectURL) generado en el cliente al cargar el archivo.
  previewUrl?: string;
};

const ALLOWED_MIMES = "application/pdf,image/jpeg,image/png,image/webp";
const ALLOWED_LABEL = "PDF, JPG, PNG o WEBP";
const MAX_MB = 15;

export function MyDocs() {
  const utils = api.useUtils();
  const list = api.documents.myList.useQuery();
  const tipos = api.tiposDocumentacion.list.useQuery();
  const create = api.documents.myCreate.useMutation({ onSuccess: () => utils.documents.myList.invalidate() });
  const replace = api.documents.myReplaceFiles.useMutation({ onSuccess: () => utils.documents.myList.invalidate() });
  const del = api.documents.myDelete.useMutation({ onSuccess: () => utils.documents.myList.invalidate() });
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [open, setOpen] = useState<{ replaceId?: string; replaceTipoId?: string } | null>(null);
  const [preview, setPreview] = useState<DocFile | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mi documentación</h1>
          <p className="text-sm text-muted-foreground">{ALLOWED_LABEL}, hasta {MAX_MB} MB por archivo.</p>
        </div>
        <Button onClick={() => setOpen({})}><Plus className="h-4 w-4" /> Subir nuevo documento</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.isLoading && <p className="col-span-3 text-muted-foreground">Cargando…</p>}
        {!list.isLoading && list.data?.length === 0 && <p className="col-span-3 text-muted-foreground">Aún no subiste documentación.</p>}
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
              <div className="flex items-center gap-2 flex-wrap">
                {d.status === "aprobada" && <Badge variant="success">Aprobada</Badge>}
                {d.status === "pendiente" && <Badge variant="warning">Pendiente</Badge>}
                {d.status === "rechazada" && <Badge variant="destructive">Rechazada</Badge>}
                {d.status === "vencida" && <Badge variant="destructive">Vencida</Badge>}
                {d.expiringSoon && <Badge variant="info">Vence pronto</Badge>}
              </div>
              {d.rejectionNotes && <p className="text-xs text-destructive">Motivo: {d.rejectionNotes}</p>}
              {d.files.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {d.files.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setPreview(f.fileObject)}
                      title={f.fileObject.originalName}
                      className="border rounded-md overflow-hidden bg-slate-50 hover:ring-2 hover:ring-primary/40 transition aspect-square flex items-center justify-center"
                    >
                      {f.fileObject.mime.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/files/${f.fileObject.relPath}`}
                          alt={f.fileObject.originalName}
                          className="object-cover w-full h-full"
                        />
                      ) : f.fileObject.mime === "application/pdf" ? (
                        <FileText className="h-10 w-10 text-red-500" />
                      ) : (
                        <ImageIcon className="h-10 w-10 text-muted-foreground" />
                      )}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => setOpen({ replaceId: d.id, replaceTipoId: d.tipoId })}>
                  <Upload className="h-4 w-4" /> Reemplazar
                </Button>
                <Button size="sm" variant="ghost" onClick={async () => {
                  const ok = await confirm({
                    title: "¿Eliminar este documento?",
                    description: `Vas a eliminar "${d.tipo.label}". Esta acción no se puede deshacer; vas a tener que volver a subir el documento.`,
                    variant: "destructive",
                    confirmLabel: "Eliminar",
                  });
                  if (!ok) return;
                  try { await del.mutateAsync({ id: d.id }); toast.success("Documento eliminado"); }
                  catch (e) { toast.error("No se pudo eliminar", e instanceof Error ? e.message : undefined); }
                }}>
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
        replaceTipoId={open?.replaceTipoId}
        tipos={tipos.data ?? []}
        onCreate={async (tipoId, files, expiresAt) => {
          await create.mutateAsync({ tipoId, fileObjectIds: files, expiresAt });
          toast.success("Documento enviado", "Lo vamos a revisar a la brevedad.");
        }}
        onReplace={async (id, files, expiresAt) => {
          await replace.mutateAsync({ documentId: id, fileObjectIds: files, expiresAt });
          toast.success("Archivos reemplazados");
        }}
      />

      <FilePreviewDialog file={preview} onClose={() => setPreview(null)} />
      {confirmDialog}
    </div>
  );
}

function FilePreviewDialog({ file, onClose }: { file: DocFile | null; onClose: () => void }) {
  const url = file ? `/api/files/${file.relPath}` : "";
  return (
    <Dialog open={!!file} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{file?.originalName ?? "Archivo"}</DialogTitle>
        </DialogHeader>
        {file && (file.mime.startsWith("image/") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={file.originalName} className="w-full max-h-[70vh] object-contain bg-muted rounded-sm" />
        ) : (
          <iframe src={url} title={file.originalName} className="w-full h-[70vh] border rounded-sm" />
        ))}
        {file && (
          <p className="text-xs text-muted-foreground">
            {file.mime} · {Math.round(file.size / 1024)} KB
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UploadDialog(props: {
  open: boolean;
  onClose: () => void;
  replaceId?: string;
  replaceTipoId?: string;
  tipos: Array<{ id: string; code: string; label: string; hasExpiry: boolean }>;
  onCreate: (tipoId: string, files: string[], expiresAt: Date | null) => Promise<void>;
  onReplace: (id: string, files: string[], expiresAt: Date | null) => Promise<void>;
}) {
  const [tipoId, setTipoId] = useState(props.replaceTipoId ?? "");
  const [expiresAt, setExpiresAt] = useState("");
  const [uploaded, setUploaded] = useState<UploadResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const tipoSelected = useMemo(
    () => props.tipos.find((t) => t.id === tipoId),
    [props.tipos, tipoId],
  );
  const hasExpiry = !!tipoSelected?.hasExpiry || !!props.replaceId;

  // Reset al cerrar
  useEffect(() => {
    if (!props.open) {
      uploaded.forEach((u) => u.previewUrl && URL.revokeObjectURL(u.previewUrl));
      setUploaded([]);
      setTipoId(props.replaceTipoId ?? "");
      setExpiresAt("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  // Pre-fill de Vencimiento desde OCR del primer archivo (si vino dato y el
  // usuario aún no lo escribió manualmente).
  useEffect(() => {
    if (!hasExpiry) return;
    if (expiresAt) return;
    const first = uploaded.find((u) => u.documentOcr?.expiresAt);
    if (first?.documentOcr?.expiresAt) {
      const iso = new Date(first.documentOcr.expiresAt).toISOString().slice(0, 10);
      setExpiresAt(iso);
      toast.info("Vencimiento detectado por OCR", "Revisalo antes de guardar.");
    }
  }, [uploaded, hasExpiry, expiresAt]);

  async function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    // Validar tamaño/tipo en cliente (defensa adicional al server)
    for (const f of arr) {
      if (f.size > MAX_MB * 1024 * 1024) {
        toast.warning("Archivo demasiado grande", `${f.name} supera ${MAX_MB} MB`);
        return;
      }
    }

    setBusy(true);
    try {
      const fd = new FormData();
      arr.forEach((f) => fd.append("files", f));
      const tipoCode = tipoSelected?.code ?? props.tipos.find((t) => t.id === props.replaceTipoId)?.code;
      const url = `/api/upload?bucket=documents${tipoCode ? `&tipoCode=${encodeURIComponent(tipoCode)}` : ""}`;
      const res = await fetch(url, { method: "POST", body: fd });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const j = (await res.json()) as { files: UploadResult[] };
      const enriched = j.files.map((f, i) => {
        const local = arr[i];
        const previewUrl = local && local.type.startsWith("image/") ? URL.createObjectURL(local) : undefined;
        return { ...f, previewUrl };
      });
      setUploaded((s) => [...s, ...enriched]);
      const warned = enriched.find((e) => e.warning);
      if (warned) toast.warning("Calidad baja", warned.warning);
    } catch (e) {
      toast.error("No se pudo subir el archivo", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  function removeUploaded(id: string) {
    setUploaded((s) => {
      const target = s.find((u) => u.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return s.filter((u) => u.id !== id);
    });
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  }

  async function submit() {
    try {
      const exp = expiresAt ? new Date(expiresAt) : null;
      const fileIds = uploaded.map((u) => u.id);
      if (props.replaceId) {
        await props.onReplace(props.replaceId, fileIds, exp);
      } else {
        await props.onCreate(tipoId, fileIds, exp);
      }
      props.onClose();
    } catch (e) {
      toast.error("No se pudo guardar", e instanceof Error ? e.message : undefined);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={(v) => { if (!v) props.onClose(); }}>
      <DialogContent className="sm:max-w-xl">
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
                  {props.tipos.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Sin tipos cargados.</div>}
                  {props.tipos.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {hasExpiry && (
            <div>
              <Label>Vencimiento</Label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Si tu documento tiene fecha de vencimiento visible, vamos a intentar autocompletarla con OCR. Verificá el dato antes de guardar.</p>
            </div>
          )}

          <div>
            <Label>Archivos</Label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "mt-1 cursor-pointer rounded-md border-2 border-dashed p-6 text-center transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-input hover:border-primary/50 hover:bg-accent/30",
              )}
              role="button"
              aria-label="Arrastrá archivos o hacé click para elegirlos"
            >
              <UploadCloud className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm">
                <strong>Arrastrá los archivos</strong> o <span className="text-primary underline">hacé click para elegirlos</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">{ALLOWED_LABEL}, hasta {MAX_MB} MB cada uno.</p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ALLOWED_MIMES}
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
            </div>
            {busy && <p className="text-xs text-muted-foreground mt-2">Subiendo…</p>}
          </div>

          {uploaded.length > 0 && (
            <div>
              <Label>Archivos cargados ({uploaded.length})</Label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
                {uploaded.map((u) => (
                  <div key={u.id} className="relative group border rounded-md overflow-hidden bg-slate-50">
                    <div className="aspect-square flex items-center justify-center">
                      {u.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.previewUrl} alt={u.originalName} className="object-cover w-full h-full" />
                      ) : u.mime === "application/pdf" ? (
                        <FileText className="h-10 w-10 text-red-500" />
                      ) : (
                        <ImageIcon className="h-10 w-10 text-muted-foreground" />
                      )}
                    </div>
                    <button
                      type="button"
                      className="absolute top-1 right-1 rounded-full bg-black/60 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); removeUploaded(u.id); }}
                      aria-label="Quitar"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <div className="px-1 py-1 text-[10px] leading-tight truncate" title={u.originalName}>
                      {u.originalName}
                    </div>
                    <div className="px-1 pb-1 text-[10px] text-muted-foreground">
                      {Math.round(u.size / 1024)} KB
                      {u.quality && ` · score ${u.quality.score}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={props.onClose}>Cancelar</Button>
          <Button
            disabled={busy || uploaded.length === 0 || (!props.replaceId && !tipoId)}
            onClick={submit}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
