"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { api } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export function AuditList() {
  const [filters, setFilters] = useState({ q: "", action: "", entity: "", ip: "" });
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const list = api.audit.list.useQuery({
    q: filters.q || undefined,
    action: filters.action || undefined,
    entity: filters.entity || undefined,
    ip: filters.ip || undefined,
    page,
    pageSize,
  });

  const exportUrl = (() => {
    const params = new URLSearchParams();
    if (filters.action) params.set("action", filters.action);
    if (filters.entity) params.set("entity", filters.entity);
    if (filters.ip) params.set("ip", filters.ip);
    return `/api/audit/export${params.toString() ? `?${params.toString()}` : ""}`;
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Auditoría</h1>
          <p className="text-sm text-muted-foreground">Logs de mutaciones y autenticación.</p>
        </div>
        <a href={exportUrl}>
          <Button variant="outline">
            <Download className="h-4 w-4" /> Exportar XLSX
          </Button>
        </a>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div>
          <Label>Buscador (entidad/ID/acción)</Label>
          <Input value={filters.q} onChange={(e) => { setFilters((f) => ({ ...f, q: e.target.value })); setPage(1); }} />
        </div>
        <div>
          <Label>Acción</Label>
          <Input value={filters.action} onChange={(e) => { setFilters((f) => ({ ...f, action: e.target.value })); setPage(1); }} placeholder="create/update/delete/login.failed…" />
        </div>
        <div>
          <Label>Entidad</Label>
          <Input value={filters.entity} onChange={(e) => { setFilters((f) => ({ ...f, entity: e.target.value })); setPage(1); }} placeholder="User, Course…" />
        </div>
        <div>
          <Label>IP</Label>
          <Input value={filters.ip} onChange={(e) => { setFilters((f) => ({ ...f, ip: e.target.value })); setPage(1); }} />
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>IP</TableHead>
            <TableHead>Usuario</TableHead>
            <TableHead>Acción</TableHead>
            <TableHead>Entidad</TableHead>
            <TableHead>ID</TableHead>
            <TableHead>Cambios</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.isLoading && (
            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Cargando…</TableCell></TableRow>
          )}
          {list.data?.items.map((it) => (
            <TableRow key={it.id}>
              <TableCell>{new Date(it.createdAt).toLocaleString("es-AR")}</TableCell>
              <TableCell className="font-mono text-xs">{it.ip ?? "—"}</TableCell>
              <TableCell>{it.user ? `${it.user.username} (${it.user.role})` : "—"}</TableCell>
              <TableCell><Badge variant="secondary">{it.action}</Badge></TableCell>
              <TableCell>{it.entity}</TableCell>
              <TableCell className="font-mono text-xs">{it.entityId ?? "—"}</TableCell>
              <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                {it.before ? `antes: ${JSON.stringify(it.before).slice(0, 60)}…` : ""}
                {it.after ? ` después: ${JSON.stringify(it.after).slice(0, 60)}…` : ""}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Total: {list.data?.total ?? 0}</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Anterior</Button>
          <span className="px-3 py-2">Página {page}</span>
          <Button size="sm" variant="outline" onClick={() => setPage((p) => p + 1)} disabled={(list.data?.items.length ?? 0) < pageSize}>Siguiente</Button>
        </div>
      </div>
    </div>
  );
}
