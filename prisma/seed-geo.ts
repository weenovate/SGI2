/**
 * Importador GeoRef Argentina + países ISO.
 *
 * Uso: `npm run seed:geo`
 *
 * Fuentes:
 *   - GeoRef AR: https://apis.datos.gob.ar/georef/api/  (gratuito, sin auth)
 *   - Países ISO: lista hardcodeada con los más comunes (se puede ampliar)
 *
 * El script es idempotente: usa upsert por id.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const GEOREF = "https://apis.datos.gob.ar/georef/api";

async function main() {
  console.log("[geo] Países ISO…");
  const paises: Array<[string, string, string]> = [
    ["ARG", "AR", "Argentina"],
    ["BOL", "BO", "Bolivia"],
    ["BRA", "BR", "Brasil"],
    ["CHL", "CL", "Chile"],
    ["COL", "CO", "Colombia"],
    ["CRI", "CR", "Costa Rica"],
    ["CUB", "CU", "Cuba"],
    ["ECU", "EC", "Ecuador"],
    ["SLV", "SV", "El Salvador"],
    ["ESP", "ES", "España"],
    ["USA", "US", "Estados Unidos"],
    ["FRA", "FR", "Francia"],
    ["GTM", "GT", "Guatemala"],
    ["HND", "HN", "Honduras"],
    ["ITA", "IT", "Italia"],
    ["MEX", "MX", "México"],
    ["NIC", "NI", "Nicaragua"],
    ["PAN", "PA", "Panamá"],
    ["PRY", "PY", "Paraguay"],
    ["PER", "PE", "Perú"],
    ["PRT", "PT", "Portugal"],
    ["DOM", "DO", "República Dominicana"],
    ["URY", "UY", "Uruguay"],
    ["VEN", "VE", "Venezuela"],
    ["GBR", "GB", "Reino Unido"],
    ["DEU", "DE", "Alemania"],
    ["CHN", "CN", "China"],
    ["JPN", "JP", "Japón"],
    ["AUS", "AU", "Australia"],
    ["CAN", "CA", "Canadá"],
  ];
  for (const [id, code2, name] of paises) {
    await db.pais.upsert({ where: { id }, update: { code2, name }, create: { id, code2, name } });
  }

  console.log("[geo] Provincias AR (GeoRef)…");
  const provRes = await fetch(`${GEOREF}/provincias?max=30`);
  if (!provRes.ok) throw new Error(`GeoRef provincias: ${provRes.status}`);
  const provJson = (await provRes.json()) as { provincias: Array<{ id: string; nombre: string }> };
  for (const p of provJson.provincias) {
    await db.provincia.upsert({
      where: { id: p.id },
      update: { name: p.nombre, paisId: "ARG" },
      create: { id: p.id, name: p.nombre, paisId: "ARG" },
    });
  }
  console.log(`[geo] ${provJson.provincias.length} provincias upserted.`);

  console.log("[geo] Localidades AR (puede tardar varios minutos)…");
  let total = 0;
  for (const prov of provJson.provincias) {
    let inicio = 0;
    const max = 5000;
    while (true) {
      const url = `${GEOREF}/localidades?provincia=${prov.id}&max=${max}&inicio=${inicio}&campos=id,nombre,provincia.id`;
      const r = await fetch(url);
      if (!r.ok) {
        console.warn(`[geo] localidades ${prov.nombre} status=${r.status}, omito`);
        break;
      }
      const j = (await r.json()) as { localidades: Array<{ id: string; nombre: string; provincia: { id: string } }>; total: number };
      if (j.localidades.length === 0) break;
      // Bulk usando createMany con skipDuplicates por idem-pot.
      await db.localidad.createMany({
        data: j.localidades.map((l) => ({ id: l.id, name: l.nombre, provinciaId: l.provincia.id })),
        skipDuplicates: true,
      });
      total += j.localidades.length;
      inicio += j.localidades.length;
      if (inicio >= j.total) break;
    }
    console.log(`[geo] ${prov.nombre}: importadas (acum ${total}).`);
  }
  console.log(`[geo] Total localidades: ${total}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
