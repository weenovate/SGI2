"use client";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type CatalogField = {
  key: string;
  label: string;
  type?: "text" | "boolean";
  required?: boolean;
  placeholder?: string;
};

export type CatalogItem = { id: string; active?: boolean; deletedAt?: Date | string | null } & Record<string, unknown>;

export function CatalogEditor<T extends CatalogItem>(props: {
  title: string;
  description?: string;
  items: T[];
  fields: CatalogField[];
  primaryKey?: string; // campo a mostrar como columna principal (default 'label')
  onCreate: (data: Record<string, unknown>) => Promise<void>;
  onUpdate: (id: string, data: Record<string, unknown>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onRestore?: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function newItem() {
    setEditing(null);
    setForm(Object.fromEntries(props.fields.map((f) => [f.key, f.type === "boolean" ? true : ""])));
    setError(null);
    setOpen(true);
  }
  function editItem(item: T) {
    setEditing(item);
    setForm(Object.fromEntries(props.fields.map((f) => [f.key, item[f.key] ?? (f.type === "boolean" ? false : "")])));
    setError(null);
    setOpen(true);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (editing) await props.onUpdate(editing.id, form);
      else await props.onCreate(form);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setBusy(false);
    }
  }

  async function del(id: string) {
    if (!props.onDelete) return;
    if (!confirm("¿Eliminar este registro? Es soft-delete (se puede restaurar).")) return;
    await props.onDelete(id);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{props.title}</h1>
          {props.description && <p className="text-sm text-muted-foreground">{props.description}</p>}
        </div>
        <Button onClick={newItem}>
          <Plus className="h-4 w-4" /> Nuevo
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {props.fields.map((f) => (
              <TableHead key={f.key}>{f.label}</TableHead>
            ))}
            <TableHead className="w-32">Estado</TableHead>
            <TableHead className="w-32 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.items.length === 0 && (
            <TableRow>
              <TableCell colSpan={props.fields.length + 2} className="text-center text-muted-foreground py-8">
                Sin registros.
              </TableCell>
            </TableRow>
          )}
          {props.items.map((item) => {
            const deleted = !!item.deletedAt;
            return (
              <TableRow key={item.id} className={deleted ? "deleted-row" : undefined}>
                {props.fields.map((f) => (
                  <TableCell key={f.key}>
                    {f.type === "boolean" ? (item[f.key] ? "Sí" : "No") : String(item[f.key] ?? "—")}
                  </TableCell>
                ))}
                <TableCell>
                  {deleted ? (
                    <Badge variant="destructive">Eliminado</Badge>
                  ) : item.active === false ? (
                    <Badge variant="secondary">Inactivo</Badge>
                  ) : (
                    <Badge variant="success">Activo</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {!deleted && (
                    <Button variant="ghost" size="icon" onClick={() => editItem(item)} aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {!deleted && props.onDelete && (
                    <Button variant="ghost" size="icon" onClick={() => del(item.id)} aria-label="Eliminar">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  {deleted && props.onRestore && (
                    <Button variant="outline" size="sm" onClick={() => props.onRestore!(item.id)}>
                      Restaurar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar" : "Nuevo"} — {props.title}</DialogTitle>
            <DialogDescription>Completá los campos requeridos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {props.fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label>{f.label}</Label>
                {f.type === "boolean" ? (
                  <div>
                    <Switch
                      checked={!!form[f.key]}
                      onCheckedChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))}
                    />
                  </div>
                ) : (
                  <Input
                    value={(form[f.key] as string) ?? ""}
                    placeholder={f.placeholder}
                    onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancelar</Button>
            <Button onClick={submit} disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
