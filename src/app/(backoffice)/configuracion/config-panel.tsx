"use client";
import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Mail, Save } from "lucide-react";
import { api } from "@/lib/trpc/react";
import { toast } from "@/lib/toast";
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
  apariencia: "Apariencia",
};

// Etiquetas legibles para los settings de tipo select (cuando los
// options vienen como slugs internos como "mar"/"sunset"/"midnight").
const SELECT_LABELS: Record<string, Record<string, string>> = {
  "appearance.theme": {
    mar: "Mar del Plata (claro náutico)",
    sunset: "Atardecer (claro cálido)",
    midnight: "Medianoche (oscuro)",
  },
  "notifications.smtp.security": {
    none: "Sin cifrado",
    ssl: "SSL",
    starttls: "STARTTLS",
  },
  "notifications.client": {
    smtp: "SMTP propio",
    resend: "Resend",
  },
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
    toast.success("Cambios guardados");
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
              {visibleSettings(grouped.get(c)!, draft).map((s) => (
                <SettingField key={s.key} setting={s} value={draft[s.key]} onChange={(v) => setField(s.key, v)} />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => saveCategory(c)} disabled={upsertMany.isPending}>
                <Save className="h-4 w-4" /> {upsertMany.isPending ? "Guardando…" : "Guardar cambios"}
              </Button>
              {c === "notificaciones" && <TestEmailButton />}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// Orden lógico de los settings de "notificaciones" (los demás
// settings se ordenan por la API por key alfabético).
const NOTIF_ORDER = [
  "notifications.enabled",
  "notifications.types",
  "notifications.client",
  // SMTP
  "notifications.smtp.host",
  "notifications.smtp.port",
  "notifications.smtp.user",
  "notifications.smtp.password",
  "notifications.smtp.security",
  "notifications.smtp.requireAuth",
  "notifications.smtp.from",
  // Resend
  "notifications.resend.apiKey",
  "notifications.resend.from",
];

// Filtro de visibilidad por categoría. En "notificaciones" mostramos
// solo los campos del provider seleccionado, además de los generales,
// y respetamos el orden lógico definido arriba.
function visibleSettings(items: Setting[], draft: Record<string, unknown>): Setting[] {
  const client = (draft["notifications.client"] as string | undefined) ?? "";
  const filtered = items.filter((s) => {
    if (s.key.startsWith("notifications.smtp.")) return client === "smtp";
    if (s.key.startsWith("notifications.resend.")) return client === "resend";
    return true;
  });
  const isNotif = filtered.some((s) => s.key.startsWith("notifications."));
  if (!isNotif) return filtered;
  const idx = (k: string) => {
    const i = NOTIF_ORDER.indexOf(k);
    return i === -1 ? 999 : i;
  };
  return [...filtered].sort((a, b) => idx(a.key) - idx(b.key));
}

function SettingField({ setting, value, onChange }: { setting: Setting; value: unknown; onChange: (v: unknown) => void }) {
  const v = value as never;
  switch (setting.type) {
    case "password":
      return <PasswordSetting label={setting.label} value={(value as string) ?? ""} onChange={(s) => onChange(s)} />;
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
    case "select": {
      const labels = SELECT_LABELS[setting.key] ?? {};
      return (
        <div className="space-y-1">
          <Label>{setting.label}</Label>
          <Select value={(value as string) ?? ""} onValueChange={(x) => onChange(x)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(setting.metadata?.options ?? []).map((opt) => (
                <SelectItem key={opt} value={opt}>{labels[opt] ?? opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }
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

function TestEmailButton() {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const send = api.settings.testEmail.useMutation();
  async function run() {
    if (!to) return;
    const res = await send.mutateAsync({ to });
    if (res.ok) toast.success("Email de prueba enviado", `ID: ${res.id ?? "—"}. Revisá la casilla destino.`);
    else toast.error("No se pudo enviar", res.error);
    setOpen(false);
  }
  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Mail className="h-4 w-4" /> Probar envío
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Input
        placeholder="destinatario@email.com"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className="w-72"
      />
      <Button onClick={run} disabled={send.isPending || !to}>
        {send.isPending ? "Enviando…" : "Enviar"}
      </Button>
      <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
    </div>
  );
}

function PasswordSetting({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10"
          autoComplete="new-password"
        />
        <button
          type="button"
          aria-label={show ? "Ocultar" : "Mostrar"}
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
