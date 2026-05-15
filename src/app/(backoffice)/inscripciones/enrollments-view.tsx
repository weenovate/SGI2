"use client";
import Link from "next/link";
import { useState } from "react";
import { Search } from "lucide-react";
import { api } from "@/lib/trpc/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CountPill } from "@/components/count-pill";

const statusLabel: Record<string, string> = {
  preinscripto: "Preinscripto",
  validar_pago: "Validar pago",
  inscripto: "Inscripto",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
  lista_espera: "Lista de espera",
};

export function EnrollmentsView() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const list = api.enrollments.list.useQuery({ q: q || undefined, status: (status || undefined) as never });
  const totalAll = api.enrollments.list.useQuery({});
  const hasFilter = !!(q || status);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          Inscripciones
          <CountPill total={totalAll.data?.total} filtered={hasFilter ? list.data?.total : undefined} loading={list.isLoading || totalAll.isLoading} />
        </h1>
        <p className="text-sm text-muted-foreground">Aprobá / rechazá / pasá a &ldquo;Validar pago&rdquo;.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label>Buscar</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" placeholder="Código, alumno, email…" />
          </div>
        </div>
        <div>
          <Label>Estado</Label>
          <Select value={status || "_"} onValueChange={(v) => setStatus(v === "_" ? "" : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_">Todos</SelectItem>
              {Object.entries(statusLabel).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Documento</TableHead>
            <TableHead>Alumno</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Curso</TableHead>
            <TableHead>Fechas</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acción</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.isLoading && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Cargando…</TableCell></TableRow>}
          {list.data?.items.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="font-mono text-xs">{e.code}</TableCell>
              <TableCell>{e.student.studentProfile?.docNumber ?? e.student.username}</TableCell>
              <TableCell>{e.student.lastName}, {e.student.firstName}</TableCell>
              <TableCell>{e.student.email}</TableCell>
              <TableCell>{e.instance.course.abbr} {e.instance.edition}</TableCell>
              <TableCell className="text-xs">{new Date(e.instance.startDate).toLocaleDateString("es-AR")} → {new Date(e.instance.endDate).toLocaleDateString("es-AR")}</TableCell>
              <TableCell><Badge>{statusLabel[e.status]}</Badge>{e.observed && <Badge variant="warning" className="ml-1">observada</Badge>}</TableCell>
              <TableCell className="text-right">
                <Link href={`/inscripciones/${e.id}`}><Button size="sm" variant="outline">Ver</Button></Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
