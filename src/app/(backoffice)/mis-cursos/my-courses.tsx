"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/trpc/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function MyCourses() {
  const [includePast, setIncludePast] = useState(false);
  const list = api.teachers.myInstances.useQuery({ includePast });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mis cursos</h1>
          <p className="text-sm text-muted-foreground">Instancias que te tienen asignado como docente.</p>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="past" checked={includePast} onCheckedChange={(v) => setIncludePast(!!v)} />
          <Label htmlFor="past">Incluir pasados</Label>
        </div>
      </div>

      {list.isLoading && <Card><CardContent className="py-6 text-muted-foreground">Cargando…</CardContent></Card>}
      {!list.isLoading && (list.data?.length ?? 0) === 0 && (
        <Card><CardContent className="py-6 text-center text-muted-foreground">No tenés cursos asignados.</CardContent></Card>
      )}
      {(list.data?.length ?? 0) > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sigla + edición</TableHead>
              <TableHead>Curso</TableHead>
              <TableHead>Modalidad</TableHead>
              <TableHead>Inicio</TableHead>
              <TableHead>Fin</TableHead>
              <TableHead>Inscriptos</TableHead>
              <TableHead className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.data?.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-mono">{i.course.abbr} {i.edition}</TableCell>
                <TableCell>{i.course.name}</TableCell>
                <TableCell><Badge variant="outline">{i.modality}</Badge></TableCell>
                <TableCell>{new Date(i.startDate).toLocaleDateString("es-AR")}</TableCell>
                <TableCell>{new Date(i.endDate).toLocaleDateString("es-AR")}</TableCell>
                <TableCell>{i._count.enrollments}</TableCell>
                <TableCell className="text-right">
                  <Link href={`/mis-cursos/${i.id}`}><Button size="sm">Abrir</Button></Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tu información de docente</CardTitle>
          <CardDescription>Si necesitás actualizar tus datos, pedile al bedel.</CardDescription>
        </CardHeader>
        <CardContent>
          <TeacherMe />
        </CardContent>
      </Card>
    </div>
  );
}

function TeacherMe() {
  const me = api.teachers.me.useQuery();
  if (me.isLoading) return <p className="text-muted-foreground">Cargando…</p>;
  if (!me.data) return null;
  return (
    <div className="text-sm space-y-1">
      <p><strong>Nombre:</strong> {me.data.user.firstName} {me.data.user.lastName}</p>
      <p><strong>CUIT:</strong> {me.data.cuit}</p>
      <p><strong>Email:</strong> {me.data.user.email}</p>
      {me.data.phone && <p><strong>Teléfono:</strong> {me.data.phone}</p>}
    </div>
  );
}
