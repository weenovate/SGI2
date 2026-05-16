/**
 * Importa el dataset de Correo Argentino:
 *   - `PostalCode` (code, provinciaId, localidadName) ← N:M completo.
 *   - `Localidad.postalCode` ← CP representativo de cada Localidad de
 *     GeoRef, elegido por match (provinciaId, name normalizado) con el
 *     dataset Correo. Si una localidad GeoRef tiene varios CPs en el
 *     Correo, se toma el menor.
 *
 * Uso: `npm run db:seed:postal`
 *
 * Fuente del CSV (committed en prisma/data/):
 *   https://github.com/androdron/localidades_AR (Correo Argentino).
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

const db = new PrismaClient();

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Parse CSV line con comillas simples
function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

async function main() {
  const csvPath = join(__dirname, "data", "localidades_cp_maestro.csv");
  console.log(`[postal] Leyendo ${csvPath}…`);
  const raw = readFileSync(csvPath, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  const header = lines.shift();
  if (!header) throw new Error("CSV vacío");

  // Estructura: provincia, id, localidad, cp, id_prov_mstr
  // Recolectamos dedup en memoria, luego un createMany.
  const rows: Array<{ code: string; provinciaId: string; localidadName: string }> = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const parts = parseLine(line);
    const localidad = parts[2]?.trim();
    const cp = parts[3]?.trim();
    const provinciaId = parts[4]?.trim();
    if (!cp || !localidad || !provinciaId) continue;
    const key = `${cp}|${provinciaId}|${localidad}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ code: cp, provinciaId, localidadName: localidad });
  }
  console.log(`[postal] ${rows.length} filas únicas.`);

  // Verificamos que las provincias existan (GeoRef ya seedeado)
  const provs = await db.provincia.findMany({ select: { id: true } });
  const provIds = new Set(provs.map((p) => p.id));
  if (provIds.size === 0) {
    throw new Error("No hay provincias seedeadas. Correr `npm run db:seed:geo` primero.");
  }
  const filtered = rows.filter((r) => provIds.has(r.provinciaId));
  console.log(`[postal] ${filtered.length} filas con provincia válida.`);

  // Limpieza y reimport idempotente
  console.log("[postal] Limpiando tabla PostalCode…");
  await db.postalCode.deleteMany({});

  // Insert en batches
  const batchSize = 1000;
  for (let i = 0; i < filtered.length; i += batchSize) {
    const chunk = filtered.slice(i, i + batchSize);
    await db.postalCode.createMany({ data: chunk, skipDuplicates: true });
    process.stdout.write(`  ${Math.min(i + batchSize, filtered.length)}/${filtered.length}\r`);
  }
  console.log("\n[postal] PostalCode poblada.");

  // Mejor match para Localidad.postalCode
  console.log("[postal] Calculando CP representativo por Localidad de GeoRef…");
  const localidades = await db.localidad.findMany({ select: { id: true, provinciaId: true, name: true } });
  // Index Correo por (provinciaId, normalizado) → lista de CPs
  const correoByKey = new Map<string, string[]>();
  for (const r of filtered) {
    const k = `${r.provinciaId}|${normalize(r.localidadName)}`;
    const arr = correoByKey.get(k) ?? [];
    arr.push(r.code);
    correoByKey.set(k, arr);
  }

  let matched = 0;
  let updated = 0;
  for (const loc of localidades) {
    const k = `${loc.provinciaId}|${normalize(loc.name)}`;
    const cps = correoByKey.get(k);
    if (!cps || cps.length === 0) continue;
    matched++;
    cps.sort();
    const rep = cps[0]!;
    await db.localidad.update({ where: { id: loc.id }, data: { postalCode: rep } });
    updated++;
  }
  console.log(`[postal] ${matched}/${localidades.length} localidades GeoRef matcheadas; ${updated} CPs asignados.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
