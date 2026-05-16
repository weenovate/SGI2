"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Grid, List, Search } from "lucide-react";
import { api, type RouterOutputs } from "@/lib/trpc/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const months = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const typeLabel: Record<string, string> = {
  completo: "Completo",
  actualizacion: "Actualización",
  completo_y_actualizacion: "Completo + Actualización",
};

export function Calendar() {
  const [view, setView] = useState<"cards" | "list">("cards");
  const [q, setQ] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [monthYear, setMonthYear] = useState<string>("_");

  const monthOptions = useMemo(() => {
    const opts: Array<{ key: string; label: string; value: { month: number; year: number } }> = [];
    const now = new Date();
    const year = now.getFullYear();
    for (let m = now.getMonth() + 1; m <= 12; m++) {
      opts.push({ key: `${year}-${m}`, label: `${months[m - 1]} ${year}`, value: { month: m, year } });
    }
    return opts;
  }, []);

  const list = api.instances.publicCalendar.useInfiniteQuery(
    {
      q: q || undefined,
      onlyAvailable,
      monthYear: monthYear !== "_" ? monthOptions.find((o) => o.key === monthYear)?.value : undefined,
      take: 12,
    },
    {
      getNextPageParam: (last) => last.nextCursor ?? undefined,
    },
  );

  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Calendario de cursos</h1>
          <p className="text-muted-foreground">Filtrá y elegí el curso que querés tomar.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={view === "cards" ? "default" : "outline"} size="icon" onClick={() => setView("cards")} aria-label="Vista cards">
            <Grid className="h-4 w-4" />
          </Button>
          <Button variant={view === "list" ? "default" : "outline"} size="icon" onClick={() => setView("list")} aria-label="Vista lista">
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label>Buscar</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" placeholder="Título / sigla / categoría" />
          </div>
        </div>
        <div>
          <Label>Mes de inicio</Label>
          <Select value={monthYear} onValueChange={setMonthYear}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_">Todos los meses</SelectItem>
              {monthOptions.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Switch id="onlyAvailable" checked={onlyAvailable} onCheckedChange={(v) => setOnlyAvailable(!!v)} />
          <Label htmlFor="onlyAvailable">Solo cursos con vacantes</Label>
        </div>
      </div>

      {list.isLoading && <p className="text-muted-foreground">Cargando…</p>}
      {!list.isLoading && items.length === 0 && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">No hay cursos para los filtros seleccionados.</CardContent></Card>
      )}

      {view === "cards" ? <CardsView items={items} /> : <ListView items={items} />}

      {list.hasNextPage && (
        <div className="flex justify-center py-4">
          <Button variant="outline" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>
            {list.isFetchingNextPage ? "Cargando más…" : "Cargar más"}
          </Button>
        </div>
      )}
    </div>
  );
}

type Item = RouterOutputs["instances"]["publicCalendar"]["items"][number];

function PillsForItem({ s }: { s: Item["status"] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {s.sinVacantes && <Badge variant="destructive">sin vacantes</Badge>}
      {!s.sinVacantes && s.pocasVacantes && <Badge variant="warning">pocas vacantes</Badge>}
      {s.cierraPronto && <Badge variant="info">cierra pronto</Badge>}
    </div>
  );
}

function CardsView({ items }: { items: Item[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {items.map((it) => (
        <Card key={it.id} className="flex flex-col">
          {it.course.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={it.course.imageUrl} alt="" className="w-full h-32 object-cover rounded-t-lg" />
          )}
          <CardHeader>
            <CardTitle className="text-base">{it.course.name}</CardTitle>
            <CardDescription className="font-mono">{it.course.abbr} {it.edition}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm flex-1">
            {it.course.category && <Badge variant="secondary">{it.course.category.label}</Badge>}
            <div className="flex items-center gap-2">
              <Badge variant="outline">{it.modality}</Badge>
              <Badge variant="outline">{typeLabel[it.type] ?? it.type}</Badge>
            </div>
            {it.teacher && <p className="text-muted-foreground">{it.teacher.name}</p>}
            <p>
              <strong>Inicio:</strong> {new Date(it.startDate).toLocaleDateString("es-AR")}<br />
              <strong>Fin:</strong> {new Date(it.endDate).toLocaleDateString("es-AR")}
            </p>
            <PillsForItem s={it.status} />
          </CardContent>
          <CardFooter>
            <Link href={`/cursos/${it.id}`} className="w-full">
              <Button className="w-full">Detalles</Button>
            </Link>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

function ListView({ items }: { items: Item[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Sigla + Edición</TableHead>
          <TableHead>Curso</TableHead>
          <TableHead>Categoría</TableHead>
          <TableHead>Inicio</TableHead>
          <TableHead>Fin</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Modalidad</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acción</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((it) => (
          <TableRow key={it.id}>
            <TableCell className="font-mono">{it.course.abbr} {it.edition}</TableCell>
            <TableCell>{it.course.name}</TableCell>
            <TableCell>{it.course.category?.label ?? "—"}</TableCell>
            <TableCell>{new Date(it.startDate).toLocaleDateString("es-AR")}</TableCell>
            <TableCell>{new Date(it.endDate).toLocaleDateString("es-AR")}</TableCell>
            <TableCell><Badge variant="outline">{typeLabel[it.type] ?? it.type}</Badge></TableCell>
            <TableCell><Badge variant="outline">{it.modality}</Badge></TableCell>
            <TableCell><PillsForItem s={it.status} /></TableCell>
            <TableCell className="text-right">
              <Link href={`/cursos/${it.id}`}>
                <Button size="sm">Detalles</Button>
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
