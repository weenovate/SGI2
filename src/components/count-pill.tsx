import { Badge } from "@/components/ui/badge";

/**
 * Pill que muestra la cantidad de registros junto al título.
 * Cuando hay filtro activo, muestra "X / Y" con color de aviso.
 *
 * Uso:
 *   <CountPill total={totalSinFiltro} filtered={resultsConFiltro} />
 *
 * Si `filtered === total` (o `filtered` no se pasa) muestra solo el total
 * con variante neutra. Si es distinto, muestra "X / Y" con variante
 * warning.
 */
export function CountPill({ total, filtered, loading }: { total?: number; filtered?: number; loading?: boolean }) {
  if (loading) return <Badge variant="outline">…</Badge>;
  if (total == null) return null;
  const isFiltered = filtered != null && filtered !== total;
  if (isFiltered) {
    return <Badge variant="warning" title={`Mostrando ${filtered} de ${total}`}>{filtered} / {total}</Badge>;
  }
  return <Badge variant="secondary">{total}</Badge>;
}
