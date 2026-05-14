"use client";
import Link from "next/link";
import { api } from "@/lib/trpc/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function AlumnoDashboard() {
  const d = api.dashboards.alumno.useQuery();

  if (d.isLoading) return <p className="text-muted-foreground">Cargando…</p>;
  if (!d.data) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Mi panel</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Próximos cursos publicados</CardTitle>
            <CardDescription>Los 5 con fecha de inicio más cercana.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {d.data.nuevosCursos.length === 0 && <p className="text-muted-foreground">No hay cursos publicados.</p>}
            {d.data.nuevosCursos.map((c) => (
              <div key={c.id} className="flex items-center justify-between border-b pb-1 last:border-0">
                <div>
                  <Link href={`/cursos/${c.id}`} className="text-primary hover:underline">
                    {c.course.abbr} {c.edition} — {c.course.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    Inicio: {new Date(c.startDate).toLocaleDateString("es-AR")}
                  </div>
                </div>
                <Badge variant="outline">{c.modality}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mis últimas inscripciones</CardTitle>
            <CardDescription><Link href="/mis-inscripciones" className="text-primary hover:underline">Ver todas</Link></CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {d.data.ultimasInscripciones.length === 0 && <p className="text-muted-foreground">Aún no te inscribiste.</p>}
            {d.data.ultimasInscripciones.map((e) => (
              <div key={e.id} className="flex items-center justify-between border-b pb-1 last:border-0">
                <div>
                  <span className="font-mono text-xs">{e.code}</span>
                  <div>{e.instance.course.abbr} — {e.instance.course.name}</div>
                </div>
                <Badge variant="secondary">{e.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas docs subidas</CardTitle>
            <CardDescription><Link href="/mi-documentacion" className="text-primary hover:underline">Ir a Mi documentación</Link></CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {d.data.ultimasDocs.length === 0 && <p className="text-muted-foreground">Aún no subiste documentación.</p>}
            {d.data.ultimasDocs.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between border-b pb-1 last:border-0">
                <span>{doc.tipo.label}</span>
                <Badge variant={doc.status === "aprobada" ? "success" : doc.status === "rechazada" ? "destructive" : doc.status === "vencida" ? "destructive" : "warning"}>{doc.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Documentos próximos a vencer</CardTitle>
            <CardDescription>Próximos 30 días.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {d.data.docsPorVencer.length === 0 && <p className="text-muted-foreground">No hay documentos por vencer.</p>}
            {d.data.docsPorVencer.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between border-b pb-1 last:border-0">
                <span>{doc.tipo.label}</span>
                <Badge variant="info">{doc.expiresAt ? new Date(doc.expiresAt).toLocaleDateString("es-AR") : "—"}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Listas de espera activas</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {d.data.listasEspera.length === 0 && <p className="text-muted-foreground">No estás en ninguna lista de espera.</p>}
            {d.data.listasEspera.map((w) => (
              <div key={w.id} className="flex items-center justify-between border-b pb-1 last:border-0">
                <div>
                  {w.instance.course.abbr} {w.instance.edition} — {w.instance.course.name}
                  <span className="text-xs text-muted-foreground ml-2">Posición #{w.position}</span>
                </div>
                {w.offers.length > 0 && <Badge variant="warning">Oferta pendiente</Badge>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
