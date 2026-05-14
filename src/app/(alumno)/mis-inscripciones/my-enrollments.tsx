"use client";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { api } from "@/lib/trpc/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const statusVariant: Record<string, "default" | "secondary" | "warning" | "success" | "destructive" | "info" | "outline"> = {
  preinscripto: "info",
  validar_pago: "warning",
  inscripto: "success",
  rechazado: "destructive",
  cancelado: "secondary",
  lista_espera: "secondary",
};

const statusLabel: Record<string, string> = {
  preinscripto: "Preinscripto",
  validar_pago: "Realizar pago",
  inscripto: "Inscripto",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
  lista_espera: "Lista de espera",
};

export function MyEnrollments() {
  const utils = api.useUtils();
  const list = api.enrollments.myList.useQuery();
  const cancel = api.enrollments.cancel.useMutation({ onSuccess: () => utils.enrollments.myList.invalidate() });
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const filtered = useMemo(() => {
    return (list.data ?? []).filter((e) => {
      if (statusFilter && e.status !== statusFilter) return false;
      if (q) {
        const text = `${e.instance.course.name} ${e.instance.course.abbr} ${e.code}`.toLowerCase();
        if (!text.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [list.data, q, statusFilter]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Mis inscripciones</CardTitle>
          <CardDescription>HU3. Podés cancelar las que aún no estén cerradas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" placeholder="Curso, sigla o código" />
              </div>
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={statusFilter || "_"} onValueChange={(v) => setStatusFilter(v === "_" ? "" : v)}>
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
                <TableHead>Sigla</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.isLoading && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Cargando…</TableCell></TableRow>}
              {!list.isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Sin inscripciones para los filtros.</TableCell></TableRow>}
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.code}</TableCell>
                  <TableCell className="font-mono">{e.instance.course.abbr} {e.instance.edition}</TableCell>
                  <TableCell>{e.instance.course.name}</TableCell>
                  <TableCell>{new Date(e.instance.startDate).toLocaleDateString("es-AR")}</TableCell>
                  <TableCell>{new Date(e.instance.endDate).toLocaleDateString("es-AR")}</TableCell>
                  <TableCell><Badge variant={statusVariant[e.status]}>{statusLabel[e.status]}</Badge></TableCell>
                  <TableCell className="text-right">
                    {(e.status === "preinscripto" || e.status === "validar_pago") && (
                      <Button size="sm" variant="ghost" onClick={async () => {
                        if (!confirm("¿Cancelar inscripción?")) return;
                        try { await cancel.mutateAsync({ id: e.id }); }
                        catch (err) { alert(err instanceof Error ? err.message : "Error"); }
                      }}>
                        <X className="h-4 w-4" /> Cancelar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
