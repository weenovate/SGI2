"use client";
import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { api } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const categoryLabels: Record<string, string> = {
  instancia: "Instancias",
  inscripciones: "Inscripciones",
  cronograma: "Cronograma",
  documentacion: "Documentación",
  pagos: "Pagos",
  seguridad: "Seguridad",
  notificaciones: "Notificaciones",
  calendario: "Calendario público",
  perfil: "Perfil del alumno",
  auditoria: "Auditoría",
  asistencia: "Asistencia y calificaciones",
  branding: "Branding",
};

type Setting = {
  key: string;
  value: unknown;
  category: string;
  label: string;
  type: string;
  metadata: { options?: string[] } | null;
};

export function ConfigPanel() {
  const list = api.settings.list.useQuery();
  const utils = api.useUtils();
  const upsertMany = api.settings.upsertMany.useMutation({
    onSuccess: () => { utils.settings.list.invalidate(); },
  });

  const grouped = useMemo(() => {
    const out = new Map<string, Setting[]>();
    for (const s of (list.data ?? []) as Setting[]) {
      const arr = out.get(s.category) ?? [];
      arr.push(s);
      out.set(s.category, arr);
    }
    return out;
  }, [list.data]);

  const [draft, setDraft] = useState<Record<string, unknown>>({});
  useEffect(() => {
    if (list.data) {
      const init: Record<string, unknown> = {};
      for (const s of list.data as Setting[]) init[s.key] = s.value;
      setDraft(init);
    }
  }, [list.data]);

  function setField(key: string, val: unknown) {
    setDraft((d) => ({ ...d, [key]: val }));
  }

  async function saveCategory(cat: string) {
    const items = (grouped.get(cat) ?? []).map((s) => ({ key: s.key, value: draft[s.key] }));
    await upsertMany.mutateAsync(items);
    alert("Cambios guardados.");
  }

  const cats = Array.from(grouped.keys()).sort((a, b) => (categoryLabels[a] ?? a).localeCompare(categoryLabels[b] ?? b));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Configuración</h1>
        <p className="text-sm text-muted-foreground">Opciones del sistema (HU + ampliadas).</p>
      </div>
      <Tabs defaultValue={cats[0] ?? "branding"}>
        <TabsList>
          {cats.map((c) => <TabsTrigger key={c} value={c}>{categoryLabels[c] ?? c}</TabsTrigger>)}
        </TabsList>
        {cats.map((c) => (
          <TabsContent key={c} value={c} className="space-y-4">
            <div className="space-y-3">
              {grouped.get(c)!.map((s) => (
                <SettingField key={s.key} setting={s} value={draft[s.key]} onChange={(v) => setField(s.key, v)} />
              ))}
            </div>
            <Button onClick={() => saveCategory(c)} disabled={upsertMany.isPending}>
              <Save className="h-4 w-4" /> {upsertMany.isPending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function SettingField({ setting, value, onChange }: { setting: Setting; value: unknown; onChange: (v: unknown) => void }) {
  const v = value as never;
  switch (setting.type) {
    case "boolean":
      return (
        <div className="flex items-center justify-between gap-3 py-1">
          <Label>{setting.label}</Label>
          <Switch checked={!!value} onCheckedChange={(b) => onChange(!!b)} />
        </div>
      );
    case "integer":
      return (
        <div className="space-y-1">
          <Label>{setting.label}</Label>
          <Input type="number" value={Number(value ?? 0)} onChange={(e) => onChange(Number(e.target.value))} />
        </div>
      );
    case "time":
    case "string":
      return (
        <div className="space-y-1">
          <Label>{setting.label}</Label>
          <Input value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
    case "richtext":
      return (
        <div className="space-y-1">
          <Label>{setting.label}</Label>
          <Textarea value={typeof value === "string" ? value : JSON.stringify(value ?? {}, null, 2)} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
    case "select":
      return (
        <div className="space-y-1">
          <Label>{setting.label}</Label>
          <Select value={(value as string) ?? ""} onValueChange={(x) => onChange(x)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(setting.metadata?.options ?? []).map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    case "multiselect":
      return (
        <div className="space-y-1">
          <Label>{setting.label}</Label>
          <Input
            value={Array.isArray(value) ? (value as string[]).join(", ") : ""}
            onChange={(e) => onChange(e.target.value.split(",").map((x) => x.trim()).filter(Boolean))}
            placeholder="valores separados por coma"
          />
        </div>
      );
    default:
      return (
        <div className="space-y-1">
          <Label>{setting.label}</Label>
          <Textarea value={typeof value === "string" ? value : JSON.stringify(v ?? {}, null, 2)} onChange={(e) => {
            try { onChange(JSON.parse(e.target.value)); } catch { onChange(e.target.value); }
          }} />
        </div>
      );
  }
}
