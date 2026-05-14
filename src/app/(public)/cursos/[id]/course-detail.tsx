"use client";
import { Check, X } from "lucide-react";
import { api } from "@/lib/trpc/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function CourseDetail({ id }: { id: string }) {
  const q = api.instances.publicById.useQuery({ id });

  if (q.isLoading) return <p className="text-muted-foreground">Cargando…</p>;
  if (q.error || !q.data) return <p className="text-destructive">No se pudo cargar el curso.</p>;
  const it = q.data;

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
            {it.sinVacantes ? (
              <Badge variant="destructive">sin vacantes</Badge>
            ) : it.free <= 3 ? (
              <Badge variant="warning">pocas vacantes</Badge>
            ) : null}
          </div>
          {it.teacher && <p><strong>Docente:</strong> {it.teacher.name}</p>}
          <p>
            <strong>Inicio:</strong> {new Date(it.startDate).toLocaleDateString("es-AR")} {it.startTime ?? ""}<br />
            <strong>Fin:</strong> {new Date(it.endDate).toLocaleDateString("es-AR")}
          </p>
          {it.course.objectives && (
            <div>
              <strong>Objetivos:</strong>
              <p className="text-muted-foreground whitespace-pre-line">{it.course.objectives}</p>
            </div>
          )}
          {it.course.program && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-medium">Ver programa</summary>
              <p className="text-muted-foreground mt-2 whitespace-pre-line">{it.course.program}</p>
            </details>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Requisitos del curso</CardTitle>
          <CardDescription>El check de cumplimiento por alumno se implementa en Sprint 4 (HU2-3).</CardDescription>
        </CardHeader>
        <CardContent>
          {it.course.requisitos.length === 0 ? (
            <p className="text-muted-foreground">Sin requisitos especiales.</p>
          ) : (
            <ul className="space-y-1">
              {it.course.requisitos.map((r) => (
                <li key={r.id} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-muted-foreground" /> {r.label}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button disabled title="La inscripción se habilita en Sprint 4">Inscribirme</Button>
      </div>

      <p className="text-xs text-muted-foreground italic flex items-center gap-1">
        <X className="h-3 w-3" /> El botón de inscripción se habilita en Sprint 4 (HU2-4 / HU2-5).
      </p>
    </div>
  );
}
