"use client";

/**
 * Store global de toasts. Permite llamar `toast.success("Listo")` desde
 * cualquier componente o handler sin context.
 */

export type ToastVariant = "info" | "success" | "warning" | "critical";

export type ToastItem = {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number;
};

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(toasts);
}

export function subscribe(l: Listener) {
  listeners.add(l);
  l(toasts);
  return () => listeners.delete(l);
}

export function dismiss(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function push(item: Omit<ToastItem, "id">) {
  const id = Math.random().toString(36).slice(2, 10);
  toasts = [...toasts, { ...item, id }];
  emit();
  return id;
}

export const toast = {
  info: (title: string, description?: string) => push({ variant: "info", title, description }),
  success: (title: string, description?: string) => push({ variant: "success", title, description }),
  warning: (title: string, description?: string) => push({ variant: "warning", title, description }),
  critical: (title: string, description?: string) => push({ variant: "critical", title, description, duration: 8000 }),
  /** Equivalente a critical. */
  error: (title: string, description?: string) => push({ variant: "critical", title, description, duration: 8000 }),
};
