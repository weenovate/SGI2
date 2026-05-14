/**
 * Seed de DATOS DEMO — SGI / FuENN
 *
 * Crea un dataset realista para hacer pruebas end-to-end:
 *   - 3 docentes (CUIT 99000000001..003)
 *   - 50 alumnos (DNI 90000001..50)
 *   - 20 cursos con sigla prefijada "D-"
 *   - 15 instancias (edición 90001..90015) repartidas en pasado/futuro
 *   - 40 inscripciones con estados mixtos
 *   - Documentación, pagos, asistencia, calificaciones y lista de
 *     espera coherentes
 *
 * Es IDEMPOTENTE: usa upsert por claves naturales (username, abbr,
 * edition+courseId, code de inscripción, etc). Se puede correr varias
 * veces sin duplicar datos.
 *
 * Marcadores para encontrar/borrar después:
 *   - Usuarios demo: username empieza con "9" (10 dígitos) o "DEMO-"
 *   - Cursos demo: abbr empieza con "D-"
 *   - Instancias demo: edition entre 90001 y 99999
 *   - Empresas demo: name empieza con "Empresa Demo "
 *
 * Uso:
 *   npm run db:seed:demo
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// --------------------------------------------------------------
// Datos base
// --------------------------------------------------------------

const FIRST_NAMES = [
  "Juan", "María", "Carlos", "Ana", "Diego", "Lucía", "Martín", "Sofía",
  "Federico", "Camila", "Pablo", "Valentina", "Sergio", "Florencia", "Andrés",
  "Julieta", "Gonzalo", "Agustina", "Mariano", "Romina", "Ezequiel", "Belén",
  "Nicolás", "Carolina", "Tomás", "Daniela", "Lucas", "Paula", "Joaquín", "Mariana",
  "Ignacio", "Victoria", "Bruno", "Mercedes", "Hernán", "Antonella", "Maximiliano",
  "Rocío", "Esteban", "Magdalena", "Cristian", "Patricia", "Leandro", "Soledad",
  "Manuel", "Constanza", "Ramiro", "Brenda", "Facundo", "Micaela",
];
const LAST_NAMES = [
  "Pérez", "González", "Rodríguez", "Fernández", "López", "Martínez", "Sánchez",
  "Romero", "Sosa", "Álvarez", "Torres", "Ruiz", "Ramírez", "Flores", "Acosta",
  "Benítez", "Medina", "Suárez", "Herrera", "Aguirre", "Pereyra", "Castro",
  "Vega", "Ortiz", "Núñez", "Silva", "Molina", "Cabrera", "Rojas", "Domínguez",
  "Vázquez", "Méndez", "Bianchi", "Russo", "Bruno", "Esposito", "Ferrari",
  "Galindo", "Heredia", "Iglesias", "Juárez", "Kovacs", "Leonardi", "Mansilla",
  "Navarro", "Olivera", "Paredes", "Quiroga", "Rivero", "Saavedra",
];

const COURSES = [
  ["D-LCI", "Capacitación Marítima Inicial (LCI)", "STCW", 40],
  ["D-EBTG", "Emergencia Básica - Tripulación General", "STCW", 16],
  ["D-AFCI", "Adiestramiento en Funciones Contra Incendios", "STCW", 24],
  ["D-AVPR", "Adiestramiento en Vigilancia y Primeros Auxilios", "STCW", 16],
  ["D-SUPV", "Supervivencia en el Mar", "STCW", 32],
  ["D-PBOT", "Procedimientos Operativos Buque Tanque", "STCW", 28],
  ["D-PEQ", "Procedimientos Operativos Buque Tanque Quimiquero", "STCW", 28],
  ["D-PGAS", "Procedimientos Operativos Buque Tanque Gas Licuado", "STCW", 28],
  ["D-MCH", "Manejo de Cargas Hazardous (IMDG)", "General", 20],
  ["D-CSEC", "Curso de Seguridad para Personal Naval", "General", 12],
  ["D-ROVN", "Radiooperador Naval", "General", 60],
  ["D-PNAV", "Patrón Fluvial - Navegación", "Fluvial", 80],
  ["D-PMET", "Patrón Fluvial - Meteorología", "Fluvial", 24],
  ["D-CFLU", "Capitán Fluvial", "Fluvial", 120],
  ["D-PESC1", "Patrón de Pesca de Primera", "Pesca", 100],
  ["D-PESC2", "Patrón de Pesca de Segunda", "Pesca", 80],
  ["D-CMN1", "Conductor de Máquinas Navales de Primera", "General", 90],
  ["D-CMN2", "Conductor de Máquinas Navales de Segunda", "General", 70],
  ["D-MEDN", "Atención Médica Naval", "Médico", 48],
  ["D-ELEN", "Electricista Naval", "STCW", 60],
] as const;

const TEACHERS = [
  { cuit: "99000000001", firstName: "Roberto", lastName: "Mansilla", email: "demo-docente-01@fuenn.local" },
  { cuit: "99000000002", firstName: "Cecilia", lastName: "Iglesias", email: "demo-docente-02@fuenn.local" },
  { cuit: "99000000003", firstName: "Andrés", lastName: "Quiroga", email: "demo-docente-03@fuenn.local" },
];

const DEMO_COMPANIES = [
  "Empresa Demo Naviera del Sur",
  "Empresa Demo Río Paraná SA",
  "Empresa Demo Atlántico Norte",
];

// LCG simple para tener un RNG determinístico
function makeRng(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}
const rnd = makeRng(42);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)]!;
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function dateAddDays(base: Date, days: number) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// --------------------------------------------------------------
// Main
// --------------------------------------------------------------

async function main() {
  console.log("=== Seed DEMO SGI ===");
  await ensureBaseCatalogs();

  const tiposDocId = await db.tipoDocumentoIdentidad.findMany();
  const dniTipo = tiposDocId.find((t) => t.code === "DNI") ?? tiposDocId[0]!;
  const titulaciones = await db.titulacion.findMany({ take: 10 });
  const sindicatos = await db.sindicato.findMany({ take: 10 });
  const categorias = await db.categoriaCurso.findMany();
  const provincias = await db.provincia.findMany({ take: 24 });

  if (titulaciones.length === 0) {
    throw new Error("Faltan catálogos: corré primero `npm run db:seed`.");
  }

  console.log("→ Empresas demo");
  const empresas = await seedEmpresas();

  console.log("→ Docentes (3)");
  const docentes = await seedDocentes(titulaciones);

  console.log("→ Alumnos (50)");
  const alumnos = await seedAlumnos(dniTipo, titulaciones, sindicatos, empresas, provincias);

  console.log("→ Cursos (20)");
  const courses = await seedCourses(categorias);

  console.log("→ Instancias (15)");
  const instances = await seedInstances(courses, docentes);

  console.log("→ Inscripciones (40)");
  const enrollments = await seedEnrollments(alumnos, instances, empresas);

  console.log("→ Documentación de alumnos");
  await seedDocuments(alumnos);

  console.log("→ Pagos");
  await seedPayments(enrollments);

  console.log("→ Lista de espera");
  await seedWaitlist(alumnos, instances);

  console.log("→ Clases, asistencia y calificaciones (instancias pasadas)");
  await seedClassesAndGrades(instances);

  console.log("OK — datos demo sembrados.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());

// --------------------------------------------------------------
// Helpers
// --------------------------------------------------------------

async function ensureBaseCatalogs() {
  const minTipos = await db.tipoDocumentacion.count();
  if (minTipos === 0) {
    throw new Error("Faltan catálogos base. Corré primero `npm run db:seed`.");
  }
}

async function seedEmpresas() {
  const out = [];
  for (const name of DEMO_COMPANIES) {
    const e = await db.empresa.upsert({
      where: { name },
      update: {},
      create: { name, status: "approved" },
    });
    out.push(e);
  }
  return out;
}

async function seedDocentes(titulaciones: Array<{ id: string }>) {
  const result = [];
  for (const t of TEACHERS) {
    const passwordHash = await bcrypt.hash("docente", 10);
    const user = await db.user.upsert({
      where: { username: t.cuit },
      update: {
        firstName: t.firstName,
        lastName: t.lastName,
        email: t.email,
        role: "docente",
        status: "active",
      },
      create: {
        username: t.cuit,
        email: t.email,
        passwordHash,
        firstName: t.firstName,
        lastName: t.lastName,
        role: "docente",
        status: "active",
        emailVerifiedAt: new Date(),
      },
    });
    const profile = await db.teacherProfile.upsert({
      where: { userId: user.id },
      update: { phone: "+541100000000", titulacionId: titulaciones[0]?.id ?? null },
      create: {
        userId: user.id,
        cuit: t.cuit,
        phone: "+541100000000",
        titulacionId: titulaciones[0]?.id ?? null,
      },
    });
    result.push({ user, profile });
  }
  return result;
}

async function seedAlumnos(
  dniTipo: { id: string },
  titulaciones: Array<{ id: string }>,
  sindicatos: Array<{ id: string }>,
  empresas: Array<{ id: string }>,
  provincias: Array<{ id: string }>,
) {
  const passwordHash = await bcrypt.hash("alumno", 10);
  const out = [];
  for (const i of range(50)) {
    const docNumber = String(90000001 + i).padStart(8, "0");
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length]!;
    const lastName = LAST_NAMES[(i * 3) % LAST_NAMES.length]!;
    const email = `demo-alumno-${String(i + 1).padStart(2, "0")}@fuenn.local`;
    const birthYear = 1980 + Math.floor(rnd() * 25);
    const birthMonth = 1 + Math.floor(rnd() * 12);
    const birthDay = 1 + Math.floor(rnd() * 28);

    const user = await db.user.upsert({
      where: { username: docNumber },
      update: { firstName, lastName, email, status: "active" },
      create: {
        username: docNumber,
        email,
        passwordHash,
        firstName,
        lastName,
        role: "alumno",
        status: "active",
        emailVerifiedAt: new Date(),
      },
    });

    await db.studentProfile.upsert({
      where: { userId: user.id },
      update: {
        docTypeId: dniTipo.id,
        docNumber,
        birthDate: new Date(Date.UTC(birthYear, birthMonth - 1, birthDay)),
        nationality: "Argentina",
        titulacionId: rnd() > 0.5 ? pick(titulaciones).id : null,
        sindicatoId: rnd() > 0.6 ? pick(sindicatos).id : null,
        empresaId: rnd() > 0.5 ? pick(empresas).id : null,
        phone: `+5411${Math.floor(rnd() * 90000000 + 10000000)}`,
        countryId: "ARG",
        provinciaId: provincias.length > 0 ? pick(provincias).id : null,
      },
      create: {
        userId: user.id,
        docTypeId: dniTipo.id,
        docNumber,
        birthDate: new Date(Date.UTC(birthYear, birthMonth - 1, birthDay)),
        nationality: "Argentina",
        titulacionId: rnd() > 0.5 ? pick(titulaciones).id : null,
        sindicatoId: rnd() > 0.6 ? pick(sindicatos).id : null,
        empresaId: rnd() > 0.5 ? pick(empresas).id : null,
        phone: `+5411${Math.floor(rnd() * 90000000 + 10000000)}`,
        countryId: "ARG",
        provinciaId: provincias.length > 0 ? pick(provincias).id : null,
      },
    });

    out.push(user);
  }
  return out;
}

async function seedCourses(categorias: Array<{ id: string; label: string }>) {
  const out = [];
  for (const [abbr, name, catLabel, workload] of COURSES) {
    const cat = categorias.find((c) => c.label === catLabel);
    const course = await db.course.upsert({
      where: { abbr },
      update: { name, workload, categoryId: cat?.id ?? null },
      create: { abbr, name, workload, categoryId: cat?.id ?? null },
    });
    out.push(course);
  }

  // Agregar 1-2 requisitos de doc a algunos cursos
  const tiposDoc = await db.tipoDocumentacion.findMany();
  const apto = tiposDoc.find((t) => t.code === "APTO_MED");
  const foto = tiposDoc.find((t) => t.code === "FOTO_4X4");
  if (apto && foto) {
    for (const course of out.slice(0, 10)) {
      for (const tipoId of [apto.id, foto.id]) {
        const exists = await db.courseRequisite.findUnique({
          where: { courseId_tipoDocumentacionId: { courseId: course.id, tipoDocumentacionId: tipoId } },
        });
        if (!exists) {
          await db.courseRequisite.create({
            data: { courseId: course.id, tipoDocumentacionId: tipoId },
          });
        }
      }
    }
  }
  return out;
}

async function seedInstances(courses: Array<{ id: string; abbr: string }>, docentes: Array<{ profile: { id: string } }>) {
  const now = new Date();
  const out = [];
  for (const i of range(15)) {
    const course = courses[i % courses.length]!;
    const edition = 90001 + i;
    const offsetDays = (i - 5) * 14; // 5 pasadas, 10 futuras
    const startDate = dateAddDays(now, offsetDays);
    const endDate = dateAddDays(startDate, 14);
    const teacher = docentes[i % docentes.length]!;
    const modalities = ["virtual", "presencial", "hibrido"] as const;
    const types = ["completo", "actualizacion", "completo_y_actualizacion"] as const;

    const inst = await db.courseInstance.upsert({
      where: { courseId_edition: { courseId: course.id, edition } },
      update: {
        startDate, endDate,
        teacherId: teacher.profile.id,
        type: types[i % types.length]!,
        modality: modalities[i % modalities.length]!,
        vacancies: 20 + (i % 3) * 10,
        startTime: "09:00",
        hoursBeforeClose: 24,
        waitlistEnabled: i % 4 === 0,
        showVacancies: true,
      },
      create: {
        courseId: course.id, edition,
        startDate, endDate,
        teacherId: teacher.profile.id,
        type: types[i % types.length]!,
        modality: modalities[i % modalities.length]!,
        vacancies: 20 + (i % 3) * 10,
        startTime: "09:00",
        hoursBeforeClose: 24,
        waitlistEnabled: i % 4 === 0,
        showVacancies: true,
      },
    });
    out.push(inst);
  }
  return out;
}

async function seedEnrollments(
  alumnos: Array<{ id: string }>,
  instances: Array<{ id: string; courseId: string; startDate: Date; endDate: Date }>,
  empresas: Array<{ id: string }>,
) {
  const statuses = ["preinscripto", "validar_pago", "inscripto", "rechazado", "cancelado"] as const;
  const out = [];
  for (const i of range(40)) {
    const inst = instances[i % instances.length]!;
    const alumno = alumnos[i % alumnos.length]!;
    const seq = String(Math.floor(i / instances.length) + 1).padStart(3, "0");
    const course = await db.course.findUniqueOrThrow({ where: { id: inst.courseId } });
    const code = `I-${course.abbr.replace(/^D-/, "")}${90001 + (i % instances.length)}-${seq}`;
    const status = statuses[i % statuses.length]!;
    const payer = i % 3 === 0 ? "empresa" : "particular";

    // Si la instancia ya inició, dejamos status=inscripto
    const finalStatus = inst.endDate < new Date() ? "inscripto" : status;

    const enrollment = await db.enrollment.upsert({
      where: { code },
      update: {
        studentId: alumno.id,
        instanceId: inst.id,
        status: finalStatus,
        payer,
        empresaId: payer === "empresa" ? empresas[i % empresas.length]?.id ?? null : null,
      },
      create: {
        code,
        studentId: alumno.id,
        instanceId: inst.id,
        status: finalStatus,
        payer,
        empresaId: payer === "empresa" ? empresas[i % empresas.length]?.id ?? null : null,
      },
    });
    out.push(enrollment);
  }
  return out;
}

async function seedDocuments(alumnos: Array<{ id: string }>) {
  const tipos = await db.tipoDocumentacion.findMany({ where: { active: true, deletedAt: null } });
  const dni = tipos.find((t) => t.code === "DNI");
  const foto = tipos.find((t) => t.code === "FOTO_4X4");
  const apto = tipos.find((t) => t.code === "APTO_MED");
  if (!dni || !foto || !apto) {
    console.warn("[demo] Faltan tipos de doc DNI/FOTO_4X4/APTO_MED — salto seedDocuments");
    return;
  }

  const now = new Date();
  for (let i = 0; i < alumnos.length; i++) {
    const alumno = alumnos[i]!;
    const profile = await db.studentProfile.findUnique({ where: { userId: alumno.id } });
    if (!profile) continue;

    // DNI: aprobado para todos
    await upsertDemoDocument(profile.id, dni.id, "aprobada", null);

    // Foto 4x4: aprobada para 80%, pendiente para resto
    await upsertDemoDocument(profile.id, foto.id, i % 5 === 0 ? "pendiente" : "aprobada", null);

    // Apto Médico: varía
    const expDays = (i % 7) - 2; // algunos vencidos, algunos por vencer
    const expiresAt = dateAddDays(now, expDays * 60);
    const status = expiresAt < now ? "vencida" : (i % 9 === 0 ? "pendiente" : "aprobada");
    await upsertDemoDocument(profile.id, apto.id, status, expiresAt);
  }
}

async function upsertDemoDocument(
  studentId: string,
  tipoId: string,
  status: "pendiente" | "aprobada" | "rechazada" | "vencida",
  expiresAt: Date | null,
) {
  const existing = await db.document.findFirst({
    where: { studentId, tipoId, deletedAt: null },
  });
  if (existing) {
    await db.document.update({
      where: { id: existing.id },
      data: { status, expiresAt },
    });
    return existing;
  }
  return db.document.create({
    data: {
      studentId,
      tipoId,
      status,
      expiresAt,
      reviewedAt: status === "aprobada" ? new Date() : null,
    },
  });
}

async function seedPayments(enrollments: Array<{ id: string; status: string; studentId: string }>) {
  // Crear un FileObject "demo" reutilizable
  const demoFile = await db.fileObject.upsert({
    where: { relPath: "demo/payment-demo.pdf" },
    update: {},
    create: {
      bucket: "payments",
      relPath: "demo/payment-demo.pdf",
      originalName: "comprobante-demo.pdf",
      mime: "application/pdf",
      size: 12_345,
    },
  });

  let counter = 0;
  for (const e of enrollments) {
    if (!["validar_pago", "inscripto"].includes(e.status)) continue;

    const existing = await db.payment.findFirst({
      where: { enrollmentId: e.id, fileObjectId: demoFile.id, deletedAt: null },
    });
    if (existing) continue;

    counter++;
    const isApproved = e.status === "inscripto";
    await db.payment.create({
      data: {
        enrollmentId: e.id,
        fileObjectId: demoFile.id,
        medio: counter % 2 === 0 ? "Transferencia" : "Mercado Pago",
        fechaPago: dateAddDays(new Date(), -7),
        monto: "15000.00",
        numeroOperacion: `OP-DEMO-${String(counter).padStart(5, "0")}`,
        ocrText: "demo data",
        ocrScore: 85,
        approved: isApproved,
        reviewedAt: isApproved ? new Date() : null,
      },
    });
  }
}

async function seedWaitlist(alumnos: Array<{ id: string }>, instances: Array<{ id: string; waitlistEnabled: boolean }>) {
  const enabled = instances.filter((i) => i.waitlistEnabled);
  if (enabled.length === 0) return;

  // 5 alumnos en lista de espera de la primera instancia con WL habilitada
  const inst = enabled[0]!;
  for (let i = 0; i < 5; i++) {
    const alumno = alumnos[40 + i];
    if (!alumno) break;
    await db.waitingListEntry.upsert({
      where: { instanceId_studentId: { instanceId: inst.id, studentId: alumno.id } },
      update: { position: i + 1, removedAt: null },
      create: { instanceId: inst.id, studentId: alumno.id, position: i + 1 },
    });
  }
}

async function seedClassesAndGrades(instances: Array<{ id: string; startDate: Date; endDate: Date }>) {
  const now = new Date();
  const past = instances.filter((i) => i.endDate < now);

  for (const inst of past) {
    // 4 clases en la duración de la instancia
    const total = 4;
    const sessions = [];
    for (let i = 0; i < total; i++) {
      const date = dateAddDays(inst.startDate, Math.floor((i + 1) * (14 / (total + 1))));
      // No hay clave única para ClassSession; usamos lookup por (instanceId, date)
      let s = await db.classSession.findFirst({ where: { instanceId: inst.id, date } });
      if (!s) {
        s = await db.classSession.create({
          data: { instanceId: inst.id, date, topic: `Clase ${i + 1}` },
        });
      }
      sessions.push(s);
    }

    // Asistencia + calificaciones para inscripciones inscriptas
    const enrollments = await db.enrollment.findMany({
      where: { instanceId: inst.id, status: "inscripto", deletedAt: null },
    });
    for (let idx = 0; idx < enrollments.length; idx++) {
      const e = enrollments[idx]!;
      // Asistencia: presente para 3 de 4 clases
      for (let i = 0; i < sessions.length; i++) {
        const status = i === 3 && idx % 2 === 0 ? "ausente" : "presente";
        await db.attendance.upsert({
          where: { classSessionId_enrollmentId: { classSessionId: sessions[i]!.id, enrollmentId: e.id } },
          update: { status },
          create: { classSessionId: sessions[i]!.id, enrollmentId: e.id, status },
        });
      }
      // Nota: 6 a 10 según idx
      const score = (6 + (idx % 5)).toFixed(2);
      await db.grade.upsert({
        where: { enrollmentId: e.id },
        update: { score, approved: Number(score) >= 6, notes: "Demo" },
        create: { enrollmentId: e.id, score, approved: Number(score) >= 6, notes: "Demo" },
      });
    }
  }
}
