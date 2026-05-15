"use client";
import { useEffect } from "react";

/**
 * Registra el service worker y maneja actualizaciones:
 *   - En cada visita, le pide al SW activo que chequee si hay update.
 *   - Si hay un SW nuevo en "waiting", le manda SKIP_WAITING para que
 *     active inmediatamente.
 *   - Cuando `controllerchange` dispara (= el SW nuevo tomó control),
 *     recarga la página una sola vez para servir los assets nuevos.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });

    navigator.serviceWorker.register("/sw.js").then((reg) => {
      reg.update().catch(() => undefined);

      function promote(sw: ServiceWorker | null) {
        if (sw && sw.state === "installed" && navigator.serviceWorker.controller) {
          sw.postMessage("SKIP_WAITING");
        }
      }
      promote(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => promote(sw));
      });
    }).catch(() => undefined);
  }, []);
  return null;
}
