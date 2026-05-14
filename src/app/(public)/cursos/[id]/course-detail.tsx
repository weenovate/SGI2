"use client";
import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { api } from "@/lib/trpc/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CourseDetail({ id }: { id: string }) {
  const utils = api.useUtils();
  const q = api.instances.publicById.useQuery({ id });
  const me = api.students.me.useQuery(undefined, { retry: false });
  const reqs = api.enrollments.checkRequirements.useQuery({ courseId: q.data?.course.id ?? "" }, { enabled: !!q.data?.course.id });
  const empresas = api.companies.listForStudents.useQuery();
  const allowMissingDocsSetting = api.settings.get.useQuery({ key: "enrollment.allowMissingDocs" });
  const enroll = api.enrollments.enroll.useMutation({
    onSuccess: () => { utils.enrollments.myList.invalidate(); utils.instances.publicById.invalidate(); },
  });
  const enterWaitlist = api.enrollments.enterWaitlist.useMutation({ onSuccess: () => utils.enrollments.myList.invalidate() });

  const [open, setOpen] = useState(false);
  const [payer, setPayer] = useState<"particular" | "empresa">("particular");
  const [empresaId, setEmpresaId] = useState<string>("");
  const [empresaSuggestion, setEmpresaSuggestion] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ code: string } | null>(null);

  const allowMissingDocs = useMemo(() => allowMissingDocsSetting.data?.value === true, [allowMissingDocsSetting.data]);

  if (q.isLoading) return <p className="text-muted-foreground">Cargando…</p>;
  if (q.error || !q.data) return <p className="text-destructive">No se pudo cargar el curso.</p>;
  const it = q.data;
  const meEmpresaId = me.data?.studentProfile?.empresaId ?? null;

  const closeAt = new Date(new Date(it.startDate).getTime());
  const showWaitlistButton = it.sinVacantes;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{it.course.name}</CardTitle>
          <CardDescription className="font-mono">{it.course.abbr} {it.edition}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {it.course.category && <Badge variant="secondary">{it.course.category}</Badge>}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{it.modality}</Badge>
            <Badge variant="outline">{it.type.replace("_", " + ")}</Badge>
            {it.sinVacantes && <Badge variant="destructive">sin vacantes</Badge>}
            {!it.sinVacantes && it.free <= 3 && <Badge variant="warning">pocas vacantes</Badge>}
          </div>
          {it.teacher && <p><strong>Docente:</strong> {it.teacher.name}</p>}
          <p>
            <strong>Inicio:</strong> {new Date(it.startDate).toLocaleDateString("es-AR")} {it.startTime ?? ""}<br />
            <strong>Fin:</strong> {new Date(closeAt).toLocaleDateString("es-AR")}
          </p>
          {it.course.objectives && (
            <div>
              <strong>Objetivos:</strong>
              <p className="text-muted-foreground whitespace-pre-line">{it.course.objectives}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Requisitos del curso</CardTitle>
          <CardDescription>HU2-3: marcamos en verde lo que cumplís y en rojo lo que falta.</CardDescription>
        </CardHeader>
        <CardContent>
          {reqs.isLoading && <p className="text-muted-foreground">Verificando…</p>}
          {reqs.data && reqs.data.items.length === 0 && <p className="text-muted-foreground">Sin requisitos especiales.</p>}
          {reqs.data && reqs.data.items.length > 0 && (
            <ul className="space-y-1">
              {reqs.data.items.map((r) => (
                <li key={r.tipoId} className="flex items-center gap-2 text-sm">
                  {r.ok ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-destructive" />}
                  <span className={r.ok ? "" : "text-destructive font-medium"}>{r.label}</span>
                  {!r.ok && (
                    <Badge variant="destructive" className="ml-2">
                      {r.reason === "missing" && "Falta"}
                      {r.reason === "pending" && "Pendiente de aprobación"}
                      {r.reason === "rejected" && "Rechazado"}
                      {r.reason === "expired" && "Vencido"}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        {showWaitlistButton && (
          <Button
            variant="outline"
            onClick={async () => {
              try { await enterWaitlist.mutateAsync({ instanceId: it.id }); alert("Te anotamos en la lista de espera."); }
              catch (e) { alert(e instanceof Error ? e.message : "Error"); }
            }}
            disabled={enterWaitlist.isPending}
          >
            Entrar a lista de espera
          </Button>
        )}
        <Button
          disabled={(!reqs.data?.allOk && !allowMissingDocs) || it.sinVacantes}
          onClick={() => { setOpen(true); setError(null); setDone(null); }}
        >
          Inscribirme
        </Button>
      </div>

      {!reqs.data?.allOk && allowMissingDocs && (
        <p className="text-xs text-muted-foreground italic">
          Hay requisitos sin cumplir. Tu inscripción quedará en estado <strong>observada</strong> hasta que completes la documentación (HU2-5).
        </p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar inscripción</DialogTitle>
            <DialogDescription>
              {it.course.name} | <strong>{it.course.abbr} {it.edition}</strong>
              <br />Inicio: {new Date(it.startDate).toLocaleDateString("es-AR")} — Fin: {new Date(it.endDate).toLocaleDateString("es-AR")}
            </DialogDescription>
          </DialogHeader>

          {done ? (
            <div className="space-y-2">
              <p>✅ Inscripción creada. Código: <strong className="font-mono">{done.code}</strong></p>
              <p className="text-sm text-muted-foreground">Podés seguir el estado en &ldquo;Mis inscripciones&rdquo;.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>¿Quién paga el curso?</Label>
                <Select value={payer} onValueChange={(v) => setPayer(v as "particular" | "empresa")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="particular">Particular (yo mismo)</SelectItem>
                    <SelectItem value="empresa">La empresa para la que trabajo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {payer === "empresa" && (
                <>
                  <div>
                    <Label>Empresa</Label>
                    <Select value={empresaId || meEmpresaId || "_"} onValueChange={(v) => setEmpresaId(v === "_" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Elegir…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_">— Otra (sugerir abajo) —</SelectItem>
                        {empresas.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {(!empresaId && !meEmpresaId) && (
                    <div>
                      <Label>Sugerir empresa nueva</Label>
                      <Input value={empresaSuggestion} onChange={(e) => setEmpresaSuggestion(e.target.value)} placeholder="Nombre de la empresa" />
                      <p className="text-xs text-muted-foreground mt-1">Quedará pendiente de aprobación por el bedel.</p>
                    </div>
                  )}
                </>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}

          <DialogFooter>
            {done ? (
              <Button onClick={() => { setOpen(false); setDone(null); }}>Cerrar</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button
                  disabled={enroll.isPending || (payer === "empresa" && !empresaId && !meEmpresaId && !empresaSuggestion)}
                  onClick={async () => {
                    setError(null);
                    try {
                      const r = await enroll.mutateAsync({
                        instanceId: it.id,
                        payer,
                        empresaId: payer === "empresa" ? (empresaId || meEmpresaId) : null,
                        empresaSuggestion: payer === "empresa" && !empresaId && !meEmpresaId ? empresaSuggestion : null,
                      });
                      setDone({ code: r.code });
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Error");
                    }
                  }}
                >Confirmar</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
