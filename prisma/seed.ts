/**
 * Seed inicial - SGI FuENN
 *
 * Carga:
 *  - 3 usuarios por defecto (admin/admin, bedel/bedel, alumno/alumno)
 *    SEGÚN PEDIDO DE LA SPEC. SON CONTRASEÑAS DÉBILES, RECOMENDAR
 *    CAMBIO INMEDIATO POST-DEPLOY (ver docs/runbook.md).
 *  - Catálogos de los Anexos B–I.
 *  - Argentina + provincias (la carga completa de localidades vía GeoRef
 *    se hace con `npm run seed:geo` en Sprint 1).
 *  - Settings con defaults para todas las opciones del panel de
 *    configuración (las de la spec + las ampliadas).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("Seeding catálogos…");
  await seedDocIdentidad();
  await seedTiposDocumentacion();
  await seedEstadosDocumentacion();
  await seedMotivosRechazo();
  await seedTitulaciones();
  await seedSindicatos();
  await seedCategorias();
  await seedGeografiaMinima();
  await seedSettings();

  console.log("Seeding usuarios por defecto (passwords débiles según spec)…");
  await seedUsuariosDefault();

  console.log("OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

// ---------------------------------------------------------------

async function seedDocIdentidad() {
  const items = [
    { code: "DNI", label: "DNI" },
    { code: "LC", label: "Libreta Cívica" },
    { code: "LE", label: "Libreta de Enrolamiento" },
    { code: "PAS", label: "Pasaporte" },
  ];
  for (const i of items) {
    await db.tipoDocumentoIdentidad.upsert({
      where: { code: i.code },
      update: { label: i.label },
      create: i,
    });
  }
}

async function seedTiposDocumentacion() {
  const items = [
    { code: "DNI", label: "DNI", hasExpiry: false, isProfilePhoto: false },
    { code: "LE", label: "Libreta de Enrolamiento", hasExpiry: false, isProfilePhoto: false },
    { code: "LC", label: "Libreta Cívica", hasExpiry: false, isProfilePhoto: false },
    { code: "PAS", label: "Pasaporte", hasExpiry: true, isProfilePhoto: false },
    { code: "LIB_EMBARCO", label: "Libreta de Embarco", hasExpiry: true, isProfilePhoto: false },
    { code: "APTO_MED", label: "Apto Médico", hasExpiry: true, isProfilePhoto: false },
    { code: "CERT_CURSO", label: "Certificado de Curso", hasExpiry: false, isProfilePhoto: false },
    { code: "FOTO_4X4", label: "Foto 4x4", hasExpiry: false, isProfilePhoto: true },
  ];
  for (const i of items) {
    await db.tipoDocumentacion.upsert({ where: { code: i.code }, update: i, create: i });
  }
}

async function seedEstadosDocumentacion() {
  const items = [
    { code: "pendiente", label: "Pendiente", color: "#f59e0b" },
    { code: "aprobada", label: "Aprobada", color: "#16a34a" },
    { code: "rechazada", label: "Rechazada", color: "#dc2626" },
    { code: "vencida", label: "Vencida", color: "#7c3aed" },
  ];
  for (const i of items) {
    await db.estadoDocumentacion.upsert({ where: { code: i.code }, update: i, create: i });
  }
}

async function seedMotivosRechazo() {
  const docMotivos = [
    "Imagen no coincide con documentación seleccionada",
    "Documentación vencida",
    "La imagen no es nítida",
    "La imagen es muy oscura",
    "Faltan partes de la documentación",
    "Otro",
  ];
  for (const label of docMotivos) {
    const exists = await db.motivoRechazoDocumentacion.findFirst({ where: { label } });
    if (!exists) await db.motivoRechazoDocumentacion.create({ data: { label } });
  }

  const inscMotivos = [
    "Falta comprobante de pago",
    "Comprobante de pago ilegible",
    "Documentación incompleta o faltante",
  ];
  for (const label of inscMotivos) {
    const exists = await db.motivoRechazoInscripcion.findFirst({ where: { label } });
    if (!exists) await db.motivoRechazoInscripcion.create({ data: { label } });
  }
}

async function seedTitulaciones() {
  const items = [
    "Capitán de Ultramar (STCW)",
    "Piloto de Ultramar de Primera (STCW)",
    "Piloto de Ultramar de Segunda (STCW)",
    "Piloto de Ultramar de Tercera (STCW)",
    "Capitán Fluvial",
    "Capitán Fluvial con conocimiento de zona",
    "Capitán de Pesca",
    "Piloto de Pesca de Primera",
    "Piloto de Pesca de Segunda",
    "Práctico",
    "Maquinista Naval Superior (STCW)",
    "Maquinista Naval de Primera (STCW)",
    "Maquinista Naval de Segunda (STCW)",
    "Maquinista Naval de Tercera (STCW)",
    "Radiooperador Naval General",
    "Radiooperador Naval de Primera",
    "Radiooperador Naval de Segunda",
    "Comisario Naval de Primera",
    "Comisario Naval de Segunda",
    "Médico Naval",
    "Patron Fluvial de Primera",
    "Patron Fluvial de Segunda",
    "Patron Fluvial de Tercera",
    "Patron Fluvial con conocimiento de zona",
    "Baqueano Fluvial",
    "Patrón de Pesca de Primera",
    "Patrón de Pesca de Segunda",
    "Patrón de Pesca Costera",
    "Patrón de Pesca Menor",
    "Conductor de Máquinas Navales de Primera",
    "Conductor de Máquinas Navales de Segunda",
    "Conductor de Máquinas Navales de Tercera",
    "Motorista Naval",
    "Personal de Cruceros (STCW)",
    "Marinero (STCW)",
    "Electricista Naval (STCW)",
    "Otro",
  ];
  for (const label of items) {
    const exists = await db.titulacion.findFirst({ where: { label } });
    if (!exists) await db.titulacion.create({ data: { label } });
  }
}

async function seedSindicatos() {
  const items = [
    ["AAEMM", "Asociación Argentina de Empleados de la Marina Mercante"],
    ["APCyBF", "Asociación Profesional de Capitanes y Baqueanos Fluviales"],
    ["CCUOMM", "Centro de Capitanes de Ultramar y Oficiales de la Marina Mercante"],
    ["CJOMN", "Centro de Jefes y Oficiales Maquinistas Navales"],
    ["CPyOF", "Centro de Patrones y Oficiales Fluviales, de Pesca y de Cabotaje Marítimo"],
    ["SAON", "Sindicato Argentino de Obreros Navales y Servicios de la Industria Naval"],
    ["SCN", "Sindicato de Comisarios Navales"],
    ["SEEN", "Sindicato de Electricistas y Electronicistas Navales"],
    ["SICONARA", "Sindicato de Conductores Navales de la República Argentina"],
    ["SOMU", "Sindicato de Obreros Marítimos Unidos"],
    ["SIPRE", "Sindicato de Prácticos de los Ríos, Puertos y Canales"],
    ["DRAGYBAL", "Sindicato del Personal de Dragado y Balizamiento"],
    ["SUPEH", "Sindicato Unidos Petroleros e Hidrocarburíferos - Rama Flota"],
  ];
  for (const [sigla, label] of items) {
    await db.sindicato.upsert({
      where: { sigla },
      update: { label },
      create: { sigla, label },
    });
  }
}

async function seedCategorias() {
  const items = ["STCW", "Fluvial", "Pesca", "Práctico", "Médico", "General"];
  for (const label of items) {
    await db.categoriaCurso.upsert({ where: { label }, update: {}, create: { label } });
  }
}

async function seedGeografiaMinima() {
  await db.pais.upsert({
    where: { id: "ARG" },
    update: {},
    create: { id: "ARG", code2: "AR", name: "Argentina" },
  });

  const provincias = [
    ["02", "Ciudad Autónoma de Buenos Aires"],
    ["06", "Buenos Aires"],
    ["10", "Catamarca"],
    ["14", "Córdoba"],
    ["18", "Corrientes"],
    ["22", "Chaco"],
    ["26", "Chubut"],
    ["30", "Entre Ríos"],
    ["34", "Formosa"],
    ["38", "Jujuy"],
    ["42", "La Pampa"],
    ["46", "La Rioja"],
    ["50", "Mendoza"],
    ["54", "Misiones"],
    ["58", "Neuquén"],
    ["62", "Río Negro"],
    ["66", "Salta"],
    ["70", "San Juan"],
    ["74", "San Luis"],
    ["78", "Santa Cruz"],
    ["82", "Santa Fe"],
    ["86", "Santiago del Estero"],
    ["90", "Tucumán"],
    ["94", "Tierra del Fuego, Antártida e Islas del Atlántico Sur"],
  ];
  for (const [id, name] of provincias) {
    await db.provincia.upsert({
      where: { id },
      update: { name },
      create: { id, paisId: "ARG", name },
    });
  }
}

async function seedUsuariosDefault() {
  const baseUsers = [
    {
      username: "Admin",
      email: "admin@fuenn.local",
      password: "admin",
      role: "admin" as const,
      firstName: "Administrador",
      lastName: "Sistema",
    },
    {
      username: "Bedel",
      email: "bedel@fuenn.local",
      password: "bedel",
      role: "bedel" as const,
      firstName: "Bedel",
      lastName: "Default",
    },
    {
      username: "Alumno",
      email: "alumno@fuenn.local",
      password: "alumno",
      role: "alumno" as const,
      firstName: "Alumno",
      lastName: "Default",
    },
  ];

  for (const u of baseUsers) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await db.user.upsert({
      where: { username: u.username },
      update: { passwordHash, role: u.role, status: "active" },
      create: {
        username: u.username,
        email: u.email,
        passwordHash,
        role: u.role,
        status: "active",
        firstName: u.firstName,
        lastName: u.lastName,
        emailVerifiedAt: new Date(),
      },
    });
  }

  // Perfil de alumno mínimo para que existan FKs
  const alumno = await db.user.findUnique({ where: { username: "Alumno" } });
  if (alumno) {
    const dniType = await db.tipoDocumentoIdentidad.findUnique({ where: { code: "DNI" } });
    await db.studentProfile.upsert({
      where: { userId: alumno.id },
      update: {},
      create: {
        userId: alumno.id,
        docTypeId: dniType?.id,
        docNumber: "00000001",
      },
    });
  }
}

async function seedSettings() {
  const defaults: Array<{
    key: string;
    value: unknown;
    category: string;
    label: string;
    type: string;
    metadata?: unknown;
  }> = [
    // Spec original
    { key: "instance.defaultVacancies", value: 30, category: "instancia", label: "Cantidad de vacantes por defecto", type: "integer" },
    { key: "instance.defaultStartTime", value: "09:00", category: "instancia", label: "Hora de inicio por defecto", type: "time" },
    { key: "instance.independentVacancies", value: true, category: "instancia", label: "Cada curso maneja vacantes independientes", type: "boolean" },
    { key: "enrollment.allowMissingDocs", value: false, category: "inscripciones", label: "Permitir inscripción con documentación vencida o faltante", type: "boolean" },
    { key: "schedule.showVacancies", value: true, category: "cronograma", label: "Mostrar vacantes al público", type: "boolean" },
    { key: "schedule.maxEnrollmentsPerStudent", value: 0, category: "cronograma", label: "Inscripciones máximas por alumno (0 = ilimitadas)", type: "integer" },
    { key: "schedule.maxEnrollmentsPerCourse", value: 1, category: "cronograma", label: "Inscripciones máximas por curso (0 = ilimitadas)", type: "integer" },
    { key: "schedule.allowMultipleEditions", value: false, category: "cronograma", label: "Permitir anotarse a más de una edición de un curso", type: "boolean" },
    { key: "schedule.publishAllInstances", value: false, category: "cronograma", label: "Habilitar inscripción a todas las instancias publicadas", type: "boolean" },
    { key: "enrollment.autoValidateDocs", value: false, category: "inscripciones", label: "Validación automática de documentación", type: "boolean" },
    { key: "notifications.enabled", value: true, category: "notificaciones", label: "Habilitar notificaciones por email", type: "boolean" },
    {
      key: "notifications.types",
      value: ["alta_usuario", "recepcion_inscripcion", "cambio_estado_inscripcion", "decision_pago", "decision_doc"],
      category: "notificaciones",
      label: "Tipos de notificación habilitados",
      type: "multiselect",
    },
    { key: "notifications.client", value: "resend", category: "notificaciones", label: "Método de envío", type: "select", metadata: { options: ["smtp", "resend"] } },

    // SMTP
    { key: "notifications.smtp.host", value: "", category: "notificaciones", label: "Servidor SMTP", type: "string" },
    { key: "notifications.smtp.port", value: 587, category: "notificaciones", label: "Puerto de salida", type: "integer" },
    { key: "notifications.smtp.user", value: "", category: "notificaciones", label: "Usuario / correo de la cuenta SMTP", type: "string" },
    { key: "notifications.smtp.password", value: "", category: "notificaciones", label: "Contraseña SMTP", type: "password" },
    { key: "notifications.smtp.security", value: "starttls", category: "notificaciones", label: "Seguridad de conexión", type: "select", metadata: { options: ["none", "ssl", "starttls"] } },
    { key: "notifications.smtp.requireAuth", value: true, category: "notificaciones", label: "Requiere autenticación", type: "boolean" },
    { key: "notifications.smtp.from", value: "", category: "notificaciones", label: "Remitente (From)", type: "string" },

    // Resend
    { key: "notifications.resend.apiKey", value: "", category: "notificaciones", label: "API Key de Resend", type: "password" },
    { key: "notifications.resend.from", value: "", category: "notificaciones", label: "Remitente (From)", type: "string" },

    // Ampliadas
    { key: "waitlist.offerWindowHours", value: 48, category: "inscripciones", label: "Validez de oferta de vacante (horas)", type: "integer" },
    { key: "enrollment.cancelMinHoursBeforeStart", value: 24, category: "inscripciones", label: "Plazo mínimo para cancelar (horas antes del inicio)", type: "integer" },
    { key: "enrollment.cancelableStatuses", value: ["preinscripto", "validar_pago"], category: "inscripciones", label: "Estados desde los que se puede cancelar", type: "multiselect" },
    { key: "waitlist.defaultEnabled", value: false, category: "inscripciones", label: "Lista de espera activa por defecto en nuevas instancias", type: "boolean" },
    { key: "waitlist.promotionMode", value: "manual", category: "inscripciones", label: "Modo de promoción desde lista de espera", type: "select", metadata: { options: ["manual", "fifo_auto"] } },

    { key: "documents.maxFileSizeMb", value: 15, category: "documentacion", label: "Tamaño máximo de archivo (MB)", type: "integer" },
    { key: "documents.allowedMimes", value: ["application/pdf", "image/jpeg", "image/png"], category: "documentacion", label: "Tipos de archivo permitidos", type: "multiselect" },
    { key: "documents.expiringSoonDays", value: 30, category: "documentacion", label: "Días antes del vencimiento para tag 'Vence Pronto'", type: "integer" },
    { key: "documents.minOcrScore", value: 60, category: "documentacion", label: "Score mínimo de calidad de imagen", type: "integer" },
    { key: "documents.maxRejectionsBeforeReview", value: 3, category: "documentacion", label: "Rechazos consecutivos antes de marcar la cuenta para revisión", type: "integer" },

    { key: "payments.maxFileSizeMb", value: 10, category: "pagos", label: "Tamaño máximo de comprobante (MB)", type: "integer" },
    { key: "payments.allowedMimes", value: ["application/pdf", "image/jpeg", "image/png"], category: "pagos", label: "Tipos de archivo permitidos", type: "multiselect" },
    { key: "payments.bankInfo", value: { cbu: "", alias: "", titular: "" }, category: "pagos", label: "Datos bancarios públicos", type: "richtext" },
    { key: "payments.instructions", value: "", category: "pagos", label: "Texto de instrucciones de pago", type: "richtext" },

    { key: "security.sessionExpiryHours", value: 8, category: "seguridad", label: "Expiración de sesión (horas)", type: "integer" },
    { key: "security.maxFailedAttempts", value: 5, category: "seguridad", label: "Intentos fallidos antes de bloquear", type: "integer" },
    { key: "security.lockMinutes", value: 15, category: "seguridad", label: "Minutos de bloqueo tras intentos fallidos", type: "integer" },
    { key: "security.emailVerificationHours", value: 24, category: "seguridad", label: "Validez del enlace de verificación de email", type: "integer" },
    { key: "security.passwordResetHours", value: 1, category: "seguridad", label: "Validez del enlace de reset de password", type: "integer" },
    { key: "security.passwordPolicy", value: { minLength: 8, requireUpper: true, requireNumber: true, requireSymbol: false }, category: "seguridad", label: "Política de password", type: "richtext" },

    { key: "notifications.daysBeforeEnrollmentClose", value: 7, category: "notificaciones", label: "Días previos al cierre de inscripción para alertar", type: "integer" },
    { key: "notifications.daysBeforeCourseStart", value: 3, category: "notificaciones", label: "Días previos al inicio para recordar al alumno", type: "integer" },
    { key: "notifications.daysBeforeDocExpiry", value: 30, category: "notificaciones", label: "Días previos al vencimiento de doc para enviar email", type: "integer" },
    { key: "notifications.fromAddress", value: "noreply@fuenn.com", category: "notificaciones", label: "Email From", type: "string" },
    { key: "notifications.fromName", value: "SGI - FuENN", category: "notificaciones", label: "Display name", type: "string" },
    { key: "notifications.replyTo", value: "contacto@fuenn.com", category: "notificaciones", label: "Reply-to", type: "string" },
    { key: "notifications.footer", value: "© FuENN — sistema de gestión de inscripciones", category: "notificaciones", label: "Pie de página común", type: "richtext" },

    { key: "calendar.itemsPerPage", value: 12, category: "calendario", label: "Cursos por página en lazy load", type: "integer" },
    { key: "calendar.showTeacher", value: true, category: "calendario", label: "Mostrar profesor en cards", type: "boolean" },
    { key: "calendar.headerText", value: "", category: "calendario", label: "Texto promocional en encabezado del calendario", type: "richtext" },
    { key: "calendar.showCloseDate", value: true, category: "calendario", label: "Mostrar fecha de cierre de inscripción en cards", type: "boolean" },

    { key: "profile.minAge", value: 18, category: "perfil", label: "Edad mínima para registrarse", type: "integer" },
    { key: "profile.requiredFields", value: ["nationality", "titulacionId", "phone"], category: "perfil", label: "Campos obligatorios al inscribirse", type: "multiselect" },
    { key: "profile.requireCompleteBeforeEnroll", value: true, category: "perfil", label: "Forzar perfil completo antes de inscribirse", type: "boolean" },

    { key: "audit.exportEnabled", value: true, category: "auditoria", label: "Habilitar export XLS de auditoría", type: "boolean" },

    { key: "attendance.minPercent", value: 75, category: "asistencia", label: "Asistencia mínima para aprobar (%)", type: "integer" },
    { key: "attendance.gradeScale", value: "numeric_1_10", category: "asistencia", label: "Escala de calificación", type: "select", metadata: { options: ["numeric_1_10", "approved_disapproved", "percent"] } },
    { key: "attendance.minPassingGrade", value: 6, category: "asistencia", label: "Nota mínima para aprobar", type: "integer" },

    { key: "branding.instituteName", value: "FuENN", category: "branding", label: "Nombre del instituto", type: "string" },
    { key: "branding.publicEmail", value: "contacto@fuenn.com", category: "branding", label: "Email público de contacto", type: "string" },
    { key: "branding.aboutText", value: "", category: "branding", label: "Texto 'Acerca de'", type: "richtext" },
    { key: "branding.terms", value: "", category: "branding", label: "Términos y Condiciones", type: "richtext" },
    { key: "branding.privacy", value: "", category: "branding", label: "Política de Privacidad", type: "richtext" },
  ];

  for (const s of defaults) {
    await db.setting.upsert({
      where: { key: s.key },
      update: { value: s.value as object, category: s.category, label: s.label, type: s.type, metadata: s.metadata as object | undefined },
      create: { key: s.key, value: s.value as object, category: s.category, label: s.label, type: s.type, metadata: s.metadata as object | undefined },
    });
  }
}
