"use client";
import { Check, Palette } from "lucide-react";
import { api } from "@/lib/trpc/react";
import { THEME_KEYS, THEME_META, type ThemeKey, themeClass } from "@/lib/theme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

/**
 * Selector de tema personal. Persiste via `users.setMyTheme` y, en
 * paralelo, intercambia la clase de <html> para que el cambio se
 * vea inmediato sin reload.
 */
export function ThemeSwitcher() {
  const q = api.users.myTheme.useQuery();
  const set = api.users.setMyTheme.useMutation({
    onSuccess: () => q.refetch(),
  });

  function applyClient(theme: ThemeKey) {
    if (typeof document === "undefined") return;
    const html = document.documentElement;
    for (const k of THEME_KEYS) html.classList.remove(themeClass(k));
    html.classList.add(themeClass(theme));
  }

  function choose(theme: ThemeKey) {
    applyClient(theme);
    set.mutate({ theme });
  }

  function resetToGlobal() {
    if (q.data?.global) applyClient(q.data.global as ThemeKey);
    set.mutate({ theme: null });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Cambiar tema" title="Cambiar tema">
          <Palette className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          Elegir tema
        </div>
        {THEME_KEYS.map((k) => {
          const meta = THEME_META[k];
          const selected = q.data?.personal === k;
          return (
            <DropdownMenuItem key={k} onSelect={(e) => { e.preventDefault(); choose(k); }}>
              <div className="flex items-center gap-2 w-full">
                <span className={`inline-block h-3 w-3 rounded-full ${swatchClass(k)}`} aria-hidden />
                <div className="flex-1">
                  <p className="text-sm">{meta.label}</p>
                  <p className="text-[10px] text-muted-foreground">{meta.description}</p>
                </div>
                {selected && <Check className="h-3 w-3 text-success" />}
              </div>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); resetToGlobal(); }}>
          <div className="flex items-center gap-2 w-full">
            <Palette className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm">Usar tema global</p>
              <p className="text-[10px] text-muted-foreground">
                {q.data?.global ? THEME_META[q.data.global as ThemeKey]?.label : "—"}
              </p>
            </div>
            {q.data?.personal === null && <Check className="h-3 w-3 text-success" />}
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function swatchClass(k: ThemeKey): string {
  switch (k) {
    case "mar":
      return "bg-[hsl(213_78%_24%)]";
    case "sunset":
      return "bg-[hsl(18_88%_48%)]";
    case "midnight":
      return "bg-[hsl(218_60%_9%)] ring-1 ring-white/20";
  }
}
