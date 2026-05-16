"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Variant = "default" | "destructive";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Aceptar",
  cancelLabel = "Cancelar",
  variant = "default",
  onConfirm,
  busy = false,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={() => onConfirm()}
            disabled={busy}
          >
            {busy ? "Procesando…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper imperativo para reemplazar `confirm()` nativo desde lugares
// donde mantener un state local es engorroso. Devuelve la API para
// montar el dialog + el callable que dispara la confirmación.
export function useConfirm() {
  const [state, setState] = useState<{
    title: string;
    description?: string;
    variant?: Variant;
    confirmLabel?: string;
    resolve: (ok: boolean) => void;
  } | null>(null);

  function confirm(opts: { title: string; description?: string; variant?: Variant; confirmLabel?: string }): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      setState({ ...opts, resolve });
    });
  }

  const dialog = (
    <ConfirmDialog
      open={!!state}
      onOpenChange={(v) => {
        if (!v && state) {
          state.resolve(false);
          setState(null);
        }
      }}
      title={state?.title ?? ""}
      description={state?.description}
      variant={state?.variant}
      confirmLabel={state?.confirmLabel}
      onConfirm={() => {
        if (state) {
          state.resolve(true);
          setState(null);
        }
      }}
    />
  );

  return { confirm, dialog };
}
