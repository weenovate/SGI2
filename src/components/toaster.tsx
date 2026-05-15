"use client";
import { useEffect, useState } from "react";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastIcon,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { dismiss, subscribe, type ToastItem } from "@/lib/toast";

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    const unsubscribe = subscribe(setItems);
    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <ToastProvider swipeDirection="right">
      {items.map((t) => (
        <Toast
          key={t.id}
          variant={t.variant}
          duration={t.duration ?? 5000}
          onOpenChange={(open) => { if (!open) dismiss(t.id); }}
        >
          <ToastIcon variant={t.variant} />
          <div className="flex-1">
            <ToastTitle>{t.title}</ToastTitle>
            {t.description && <ToastDescription>{t.description}</ToastDescription>}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
