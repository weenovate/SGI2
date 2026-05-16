# Handoff técnico — SGI / FuENN

> Documento para retomar el trabajo en otra sesión sin perder contexto.
> Última actualización: junto con commit `016cb4c` sobre `main`
> (testing exhaustivo + 3 fixes de seguridad, race condition y UX).

---

## 1. Resumen ejecutivo

**SGI** (Sistema de Gestión de Inscripciones) es una webapp para
**FuENN**, instituto de capacitación marítima. Tiene dos frontales bajo
un único proyecto Next.js:

| Subdominio                  | Para quién         | Ruta default cuando hay sesión |
| --------------------------- | ------------------ | ------------------------------ |
| `inscripciones.fuenn.com`   | Alumnos + público  | `/mi-dashboard` (alumno) o `/calendario` (anónimo) |
| `sgi.fuenn.com`             | Backoffice         | `/dashboard`                   |

El middleware (`src/middleware.ts`) detecta el host y permite que cada
subdominio renderice solo las rutas que le corresponden. Para el host
público, la decisión de redirección la toma `src/app/page.tsx` para
poder leer la sesión.

**Estado**: MVP completo (Sprints 0–8) más dos iteraciones (#1 y #2).
Todo el código está en `main`.

---

## 2. Acceso y branches

- **Repo**: `weenovate/sgi2` (GitHub).
- **Rama de trabajo**: **siempre `main`** (regla impuesta por el cliente).
- **Última rama de feature borrada (local)**: `claude/analyze-specs-plan-sprints-DNPnb`. El remote
  no se pudo borrar por HTTP 403; quedó pendiente borrar manualmente
  desde la UI de GitHub.
- **Producción**: VPS con cPanel/WHM, deploy desde `main`.

### Regla operativa estricta (importante)

> El cliente impuso este flujo. **No romperlo**.

1. Antes de modificar código: `git branch --show-current`. Si no es
   `main`, **avisar y no hacer cambios**.
2. `git pull origin main` antes de empezar.
3. Después de modificar: commit a `main`, push a `origin main`,
   confirmar el hash al cliente.
4. **No dejar cambios en branches `claude/*` sin PR**. Si por
   algún motivo necesitás una rama, avisá primero, abrí PR, pasá el
   link y aclará que **producción no verá los cambios hasta el
   merge a `main`**.
5. **No decir "pusheado" o "listo para producción"** si el cambio
   quedó en otra rama. En ese caso: "pusheado a branch secundaria,
   falta mergear a main".
6. El VPS solo actualiza desde `main`.

---

## 3. Stack & arquitectura

| Área           | Tecnología                                                     |
| -------------- | -------------------------------------------------------------- |
| Frontend       | Next.js 15 (App Router) + React 19 + TypeScript                |
| Estilos        | Tailwind CSS + componentes propios estilo shadcn/ui             |
| Backend        | Next.js API Routes + **tRPC v11** (mismo proyecto)             |
| DB             | **MySQL** + **Prisma 6**                                       |
| Auth           | **Auth.js v5** (NextAuth beta) credentials + JWT, 8 hs default |
| Email          | **Resend** (`fuenn.com` con DKIM/SPF a configurar en prod)     |
| OCR / IA       | **Tesseract.js** (local) + **sharp** para heurísticas          |
| Storage        | Disco local del VPS **fuera del webroot**, servido por `/api/files/[...]` con validación de sesión y permisos |
| PWA            | `manifest.webmanifest` + `sw.js` (network-first para HTML)     |
| Hosting        | VPS AlmaLinux + cPanel/WHM, Node con PM2, reverse-proxy Apache |
| Crons          | `cPanel → Cron Jobs` que pegan a `/api/cron/<task>` con Bearer  |
| CI/CD          | Sin pipeline. Script `scripts/deploy.sh` corre `npm ci + prisma + build + pm2 restart` |

---

## 4. Estructura del repo

```
prisma/
├── schema.prisma              # ~30 modelos, MySQL, soft-delete en la mayoría
├── seed.ts                    # catálogos Anexos B–I + 3 users default + settings
├── seed-geo.ts                # GeoRef AR (provincias + ~4000 localidades)
└── seed-demo.ts               # 50 alumnos, 20 cursos, 15 instancias, etc.

public/
├── branding/
│   ├── logo.png               # logo principal (rosa de los vientos + FUENN)
│   └── logo-alt.png
├── manifest.webmanifest
└── sw.js                      # service worker network-first

scripts/
└── deploy.sh                  # idempotente

src/
├── app/
│   ├── (public)/              # host: inscripciones.fuenn.com
│   │   ├── calendario/        # HU1 — cards/lista + filtros + lazy load
│   │   ├── cursos/[id]/       # HU2 — detalle + requisitos + inscripción
│   │   ├── login/             # form login + LoggedInSwitcher
│   │   ├── registro/          # alta de alumnos
│   │   ├── verificar-email/
│   │   ├── confirmar-email/   # cambio de email del alumno
│   │   ├── reset-password/
│   │   ├── after-login/       # cross-host redirect según rol
│   │   ├── notificaciones/    # inbox global (cualquier rol)
│   │   └── lista-espera/[offerId]/aceptar/
│   ├── (alumno)/              # host: inscripciones.fuenn.com, rol alumno
│   │   ├── layout.tsx         # header con UserMenu, NotificationsBell
│   │   ├── mi-dashboard/      # HU6
│   │   ├── mis-inscripciones/ # HU3
│   │   ├── mi-documentacion/  # HU4 con drag&drop + OCR
│   │   └── mis-datos/         # HU5 (perfil, email, password)
│   ├── (backoffice)/          # host: sgi.fuenn.com
│   │   ├── layout.tsx         # sidebar condicional por rol
│   │   ├── dashboard/         # HU13 KPIs + chart recharts
│   │   ├── cronograma/        # CRUD instancias + /[id]/lista-espera
│   │   ├── cursos/            # CRUD HU7
│   │   ├── docentes/          # CRUD HU8 con email + reset + transfer
│   │   ├── alumnos/           # CRUD HU10 (lista, alta, reset, soft-del)
│   │   ├── inscripciones/     # HU12 lista + detalle con tabs
│   │   ├── documentacion/     # HU11 cola pendientes/aprobadas/rechazadas/vencidas
│   │   ├── empresas/          # CRUD + cola de aprobación de sugerencias
│   │   ├── catalogos/         # tabs por catálogo
│   │   ├── usuarios/          # admin/bedel/manager
│   │   ├── auditoria/         # con export XLSX
│   │   ├── configuracion/     # ~50 settings con tabs por categoría
│   │   └── mis-cursos/        # vista docente: alumnos / asistencia / calificaciones
│   ├── api/
│   │   ├── trpc/[trpc]/
│   │   ├── auth/[...nextauth]/
│   │   ├── files/[...path]/   # storage privado con auth
│   │   ├── upload/            # multipart + OCR (comprobantes y docs)
│   │   ├── audit/export/      # XLSX
│   │   └── cron/[task]/       # invocado por cPanel cron
│   └── page.tsx               # root: redirect por rol/sesión
├── components/
│   ├── ui/                    # button, input, card, dialog, select, tabs,
│   │                          # switch, table, badge, dropdown-menu, toast,
│   │                          # checkbox
│   ├── brand-logo.tsx
│   ├── catalog-editor.tsx     # editor genérico de catálogos simples
│   ├── count-pill.tsx         # pill X/Y con color de filtro
│   ├── notifications-bell.tsx
│   ├── providers.tsx          # SessionProvider + tRPC + Toaster + SW
│   ├── sw-register.tsx
│   ├── toaster.tsx
│   └── user-menu.tsx          # dropdown Mi perfil / Cerrar sesión
├── lib/
│   ├── auth.ts                # NextAuth config (cookies cross-subdomain)
│   ├── audit.ts
│   ├── db.ts                  # PrismaClient
│   ├── email.ts               # Resend + plantilla con logo
│   ├── env.ts                 # zod schema de env vars
│   ├── ocr.ts                 # Tesseract + sharp + extractExpiryDate
│   ├── storage.ts             # filesystem privado con path-traversal guard
│   ├── toast.ts               # store global (sin context)
│   ├── tokens.ts              # verify-email / reset-password / change-email
│   ├── utils.ts               # cn()
│   └── trpc/
│       ├── react.tsx          # TRPCProvider + RouterInputs/Outputs
│       ├── server.ts          # createCaller server-side
│       └── shared.ts          # transformer + baseUrl
├── server/
│   ├── jobs/                  # handlers de cron
│   │   ├── document-expiry.ts
│   │   ├── enrollment-jobs.ts
│   │   └── notifications-expire.ts
│   ├── services/
│   │   ├── document-ocr.ts    # OCR + keyword match por tipo
│   │   ├── enrollment-code.ts # genera I-LCI5626-018
│   │   ├── notifications.ts   # notifyUser/notifyRole + lifecycle helpers
│   │   ├── payment-ocr.ts     # OCR de comprobantes (medio/fecha/monto/op)
│   │   └── requirements.ts    # HU2-3 + snapshot inmutable
│   └── trpc/
│       ├── root.ts            # composición de todos los routers
│       ├── trpc.ts            # context, procedures, roleProcedure
│       ├── selects.ts         # userPublicSelect (sin passwordHash) reutilizable
│       └── routers/           # ver lista abajo
└── middleware.ts              # multi-host

tests/
└── e2e/smoke.spec.ts          # Playwright

# Unit tests (sin DB, vitest):
src/server/services/payment-ocr.test.ts
src/server/services/payment-ocr-edge.test.ts
src/server/services/document-ocr.test.ts
src/server/services/enrollment-code.test.ts

vitest.config.ts + vitest.setup.ts   # unit tests
playwright.config.ts
```

### Routers tRPC (`src/server/trpc/routers/`)

| Router          | Procedures clave                                                              | Notas |
| --------------- | ----------------------------------------------------------------------------- | ----- |
| `audit`         | `list` (admin) con filtros + export XLSX en `/api/audit/export`               | |
| `catalogs`      | `titulaciones`, `sindicatos`, `categorias`, `tiposDocumentacion`, `estados`, `motivos.{doc,inscripcion}`, `tiposDocId` con `list/create/update/softDelete/restore` | `list` es público para llenar selects |
| `classes`       | `list/create/remove/setAttendance/summary` (docente)                          | Resp. HU asistencia |
| `companies`     | CRUD + `suggest` (público alumno) + `approve/reject` (bedel)                  | |
| `courses`       | CRUD HU7 + requisitos                                                         | |
| `dashboards`    | `alumno` (HU6) + `backoffice` (HU13)                                          | |
| `documents`     | `myList/myCreate/myReplaceFiles/myDelete` (alumno) + `list/approve/reject/versions/hardDeleteFile` (bedel) | HU4-3/HU11-2 con autoValidate |
| `enrollments`   | `checkRequirements`, `enroll`, `cancel`, `myList`, `enterWaitlist/leaveWaitlist`, `list/byId/approve/reject` (bedel), `waitlistForInstance/reorderWaitlist/offerVacancy`, `acceptOffer/rejectOffer` | HU2-3/4/5, HU3, HU12, lista de espera |
| `geo`           | `paises/provincias/localidades`                                               | |
| `grades`        | `byEnrollment/upsert` (docente)                                               | Notifica al alumno |
| `instances`     | CRUD HU9 + `publicCalendar` (HU1 con cursor pagination + onlyAvailable + monthYear) + `publicById` | |
| `notifications` | `myList`, `myUnreadCount`, `markRead/markAllRead`, backoffice `create/list/remove` | |
| `payments`      | `myList/myCreate` (alumno con OCR pre-poblado) + `list/approve/reject` (bedel) + `inscripcionState` | |
| `registration`  | `registerStudent`, `verifyEmail`, `requestPasswordReset`, `confirmPasswordReset` | |
| `settings`      | `list/get/upsert/upsertMany` con coerción por tipo                            | Categorías: instancia, inscripciones, documentacion, pagos, seguridad, notificaciones, calendario, perfil, auditoria, asistencia, branding |
| `students`      | `me/updateProfile/requestEmailChange/confirmEmailChange/changePassword` (alumno) + `list/create/resetPassword/softDelete/restore` (bedel) | HU5 + HU10 |
| `teachers`      | `me/myInstances/alumnosForInstance` (docente) + CRUD (bedel) + `resetPassword/softDelete` | HU8 + Sprint 7 |
| `users`         | `list/create/update/resetPassword/softDelete/restore` admin only (HU14)        | Solo admin/bedel/manager |

Tipos del cliente: `RouterInputs` y `RouterOutputs` en `src/lib/trpc/react.tsx`.

---

## 5. Modelo de datos (resumen)

Ver `prisma/schema.prisma` para el detalle. Entidades principales:

- **User** + **Account** + **Session** + **VerificationToken** (Auth.js).
  Roles: `admin | bedel | manager | docente | alumno`. Soft-delete con
  `deletedAt`. Lockout: `failedAttempts`, `lockedUntil`.
- **StudentProfile** (1-1 con User), **TeacherProfile**.
- **Course** (curso maestro) + **CourseRequisite** (tipos de doc requeridos).
- **CourseInstance** (edición del curso, `@@unique([courseId, edition])`).
- **Enrollment** (`code` único tipo `I-LCI5626-018`, status enum). Tiene
  `EnrollmentDocumentSnapshot` (copia inmutable de docs al inscribirse).
- **WaitingListEntry** + **WaitingListOffer** (oferta de vacante, expira).
- **Document** + **DocumentFile** + **DocumentVersion** (histórico de
  versiones rechazadas/reemplazadas, inmutable).
- **Payment** (comprobante con OCR: medio/fecha/monto/numeroOperacion +
  rawText + score).
- **Empresa** (`status: approved | pending_approval | rejected`).
- **Notification** + **NotificationRead** (audience JSON con
  `roles[]`/`userIds[]`/`all`).
- **ClassSession** + **Attendance** + **Grade** (Sprint 7).
- **FileObject** (físico en disco, name original en DB, UUID en path).
- **AuditLog** (mutaciones + login/logout).
- **Setting** (config global key/value + categoría).
- Catálogos: `TipoDocumentoIdentidad`, `TipoDocumentacion`,
  `EstadoDocumentacion`, `MotivoRechazo{Documentacion,Inscripcion}`,
  `Titulacion`, `Sindicato`, `CategoriaCurso`.
- Geo: `Pais`, `Provincia`, `Localidad`.

---

## 6. Estado de implementación (MVP: Sprints 0–8)

| Sprint | Commit | Contenido | HUs |
| ------ | ------ | --------- | --- |
| 0 | `75e9571` | Scaffold Next.js + Prisma + Auth + tRPC + storage privado + SW | — |
| 1 | `f3f3a84` | Catálogos, CRUDs base, panel de configuración (~50 settings), auditoría con export XLSX | HU7, HU8, HU14, varios |
| 2 | `5c7805f` | Cronograma backoffice + Calendario público (cards/lista, lazy load, filtros, pills) + PWA shell | HU1, HU9 |
| 3 | `2d9c224` | Alumnos backoffice + registro + verificación email + reset password + Mi Documentación + crons vencimiento | HU4, HU5, HU10, HU11 |
| 4 | `d2df9df` | Inscripciones núcleo + lista de espera + snapshot inmutable + cron de cierre | HU2-3, HU2-4, HU2-5, HU3, HU3-5, HU12 |
| 5 | `492ef2a` | Pagos con OCR + validación automática de documentación | OCR sobre comprobantes y docs |
| 6 | `f9bd39d` | Dashboards (alumno + backoffice con chart) + notificaciones email + in-app | HU6, HU13 |
| 7 | `530f360` | Docente: cursos propios + asistencia + calificaciones | Alcance ampliado |
| 8 | `5f379f8` | Hardening: vitest + playwright + runbook + security-checklist + deploy.sh | — |

**Branding** (commit `cc7e87f`): logo FuENN integrado en headers (alumno
+ backoffice + público + login) y emails.

**Seed demo** (commit `c3a0afe`): `prisma/seed-demo.ts` con 50 alumnos /
20 cursos / 15 instancias / 40 inscripciones + docs + pagos + asistencia.
Idempotente.

---

## 7. Iteraciones post-MVP

### Iteración #1
1. Bug login → forbidden + header sin info de usuario logueado.
   - Resuelto en `8bfa739` + previos (`d877821`).

### Iteración #2 (commits actuales sobre `main`)

| # | Tema | Commit |
| - | ---- | ------ |
| A (1, 5, 6, 7, 8) | UI alumno: Mi perfil submenu, Inicio persistente, sacar "Mi cuenta", quitar leyenda HU3, default = dashboard | `8bfa739` |
| B (2) | Catálogos de lectura abiertos: select de Tipo de Documentación funciona en `/mi-documentacion` y registro público | `c56b7ad` |
| C (13, 14) | Sesión cross-subdomain + cross-host post-login + LoggedInSwitcher | `e459445` |
| D (10) | Toaster con código de colores + reemplazo de `alert()` | `c52b83d` |
| E (11) | Inbox `/notificaciones` tipo bandeja con tabs y leídas/no leídas | `1addd33` |
| F (12) | Pill X/Y de cantidad en CRUDs con color de filtro | `5deebf1` |
| G (3, 4) | Mi Documentación: drag&drop, miniaturas, leyenda tipos/tamaño, Vencimiento con OCR autocomplete | `44e66d2` |

**Pendiente del cliente**: el "ítem 9" no existía en la lista (saltó
del 8 al 10). Si pide algo, agregarlo.

### Iteración #2.bis — Testing exhaustivo + fixes detectados por review

Después de pedir "tests exhaustivos", se cubrieron typecheck/build/lint
y la suite vitest creció de 7 a **25 tests**. El code review encontró
3 bugs reales que se arreglaron y commitearon a `main`:

| # | Commit | Severidad | Bug y fix |
| - | ------ | --------- | --------- |
| 1 | `5925e85` | 🔴 Seguridad | Los `findMany`/`findUnique` de User en `users`, `students`, `teachers`, `enrollments`, `documents`, `classes` retornaban `passwordHash` + `failedAttempts` + `lockedUntil` al cliente. Fix: nuevo `src/server/trpc/selects.ts` con `userPublicSelect` aplicado en todos los endpoints expuestos. Las queries internas (verificación de password en `changePassword`/`requestEmailChange`) NO se tocan porque necesitan el hash para `bcrypt.compare`. |
| 2 | `c4851ab` | 🟡 Integridad | `enrollments.enroll` contaba vacantes y límites **fuera** de la transacción. Dos enrolls simultáneos podían overbookear. Fix: la tx abre con `SELECT ... FOR UPDATE` sobre `CourseInstance` (lock pesimista por fila → otros enroll a la misma instancia esperan al COMMIT). Todos los recuentos (`taken`, `sameInstance`, `sameCourse`, `maxPerStudent`) ahora corren dentro de la sección crítica. |
| 3 | `016cb4c` | 🟠 UX | `/cronograma/[id]/lista-espera` mostraba el cuid del alumno (`studentId`) en lugar del nombre. Fix: `waitlistForInstance` hace join manual contra `User` (la relación Prisma no estaba modelada, evita migración) y la UI muestra "Apellido, Nombre · DNI · email". |

#### Bugs menores detectados pero NO arreglados (decisión consciente)

- **`confirm()` nativo en 8 lugares** (empresas, mis-cursos, usuarios,
  alumnos, cronograma, cursos, mis-inscripciones, mi-documentacion).
  Funciona; reemplazar con `AlertDialog` es cosmético y toca muchos
  archivos. Iteración aparte.
- **Mutations sin `onError` en backoffice** (`reset.mutate`,
  `approve.mutate`, `reject.mutate`, etc.): silent failures, el error
  va a consola pero no al usuario. Sería bueno cablearlos a `toast.error`.
- **`acceptOffer` sin lock pesimista**: cada offer se acepta una sola
  vez por diseño, riesgo marginal.
- **OCR slow start de Tesseract**: documentado en sección 13. Requiere
  warmup post-deploy.

### Iteración #3 — Inscripciones backoffice (preview modal) + Mis Datos (CP, password)

7 ítems del cliente:

| # | Tema | Cambio |
| - | ---- | ------ |
| 1 | Snapshot de documentación con miniaturas + modal | `enrollments.byId` ahora resuelve `tipoDocumentacion` + `FileObject[]` desde el CSV de `fileObjectIds`. UI en `enrollment-detail.tsx`: grid de miniaturas (imagen real para `image/*`, ícono para PDF/otros) y dialog `FilePreviewDialog` con metadata (tipo, vencimiento, status, uploadedAt, archivo). |
| 2 | Comprobantes de pago en modal | Eliminado `target="_blank"` en `PaymentItem`. El nombre ahora es un `<button>` que abre el mismo `FilePreviewDialog`. Imágenes inline, PDFs en iframe. |
| 3 | "Tipo doc" mostraba el cuid | En `my-data.tsx` se agrega `api.tiposDocId.list.useQuery()` y se resuelve el label vía `useMemo`. |
| 4 | Orden de Dirección | Reordenado a Calle / Altura / Piso / Depto / Cód. postal / Localidad / Provincia. Provincia ahora es un `<Input disabled>` (label, no editable). |
| 5 | CP ↔ Localidad ↔ Provincia | Nuevo modelo `PostalCode` (code, provinciaId, localidadName) + `Localidad.postalCode` + `StudentProfile.postalCode`. Endpoints: `geo.findByPostalCode` (resuelve georefLocalidadId por match `(provinciaId, normalize(name))`) y `geo.localidadById`. UI: al tipear CP autocompleta provincia y preselecciona localidad GeoRef matcheada; al cambiar localidad, autocompleta CP (si la localidad tiene `postalCode`) y provincia (siempre). Dataset Correo Argentino commiteado en `prisma/data/localidades_cp_maestro.csv` (23k filas). Seed script `npm run db:seed:postal`. |
| 6 | Show/hide password | Nuevo componente local `PasswordInput` con ícono `Eye/EyeOff` (lucide), aplicado en "Contraseña actual"/"Nueva contraseña" del tab `password` y en "Tu contraseña actual" del tab `email`. |
| 7 | Re-login obligatorio tras cambio de password | Tras éxito de `changePassword`, abre Dialog modal con `onEscapeKeyDown` + `onPointerDownOutside` blockeados. Botón "Aceptar" llama `signOut({ callbackUrl: "/login" })`. |

**Migración de DB requerida**: `npx prisma db push` en VPS para aplicar los nuevos campos. Luego correr `npm run db:seed:postal` una vez para cargar el dataset Correo Argentino y poblar `Localidad.postalCode`.

---

## 8. Convenciones de código y UI

- **Server vs client components**: pages que necesitan leer sesión son
  Server Components (con `export const dynamic = "force-dynamic"`).
  Los formularios e interacciones son `"use client"`.
- **Tipos del cliente**: `import { api, type RouterOutputs } from "@/lib/trpc/react"`.
- **Toasts**: `import { toast } from "@/lib/toast"`. Variantes:
  `info` (azul), `success` (verde), `warning` (naranja),
  `critical`/`error` (rojo).
- **Auth check en pages**:
  ```ts
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/...");
  if (!["admin","bedel"].includes(session.user.role)) redirect("/...");
  ```
- **Soft-delete**: tabla con `deletedAt` nullable. Listas filtran
  `deletedAt: null` por default; pasar `includeDeleted: true` para
  ver eliminados. Admin ve filas con clase `deleted-row` (rojo).
- **Auditoría**: en cada mutation server, llamar `audit({...})`.
  Acciones: `create/update/delete/restore/approve/reject/login.*/password.*/email.change`.
- **Settings**: leer con `db.setting.findUnique({ where: { key } })`
  con fallback. Helpers existentes en routers grandes.
- **Catalog readonly**: los `list:` de catálogos son `publicProcedure`
  (helper `readCatalog`). Los `create/update/softDelete/restore`
  son `adminOrBedel()` o `adminOnly()`.
- **Exposición de User**: cuando un endpoint retorne User al cliente,
  usar `select: userPublicSelect` (de `src/server/trpc/selects.ts`)
  para excluir `passwordHash`, `failedAttempts` y `lockedUntil`. Si
  hay un nested include `include: { user: true }`, cambiar a
  `include: { user: { select: userPublicSelect } }`. Solo se permite
  leer el hash en queries internas que después comparen con bcrypt
  (changePassword, requestEmailChange, authorize).
- **Mutations con conteo + create**: si la lógica depende de un
  conteo (vacantes, límites, unicidad), envolver TODO en una
  transacción que abra con `tx.$queryRaw\`SELECT id FROM Tabla WHERE id = ${id} FOR UPDATE\`;`
  para evitar race conditions. Ver `enrollments.enroll` como
  referencia.

---

## 9. Deploy & operación

Documentación detallada en:
- `docs/deploy-cpanel.md` — cómo deployar desde cero en cPanel.
- `docs/runbook.md` — operación: crons, backups, errores, checklist.
- `docs/security-checklist.md` — pre go-live.

### Deploy típico

```bash
ssh <user>@<vps>
cd ~/apps/sgi
git pull origin main
bash scripts/deploy.sh
```

El script hace `git fetch + reset --hard origin/main + npm ci +
prisma generate + prisma migrate deploy + npm run build + pm2 restart`.

### Crons en cPanel (todos con `Authorization: Bearer $CRON_SECRET`)

| Frecuencia | Task                              |
| ---------- | --------------------------------- |
| hora       | `documents.markExpiringSoon`      |
| hora       | `documents.markExpired`           |
| hora       | `enrollments.closeWindow`         |
| hora       | `waitlist.expireOffers`           |
| diario     | `notifications.expire`            |

---

## 10. Variables de entorno

`.env.example` está commiteado. Las clave para producción:

```env
NODE_ENV=production
DATABASE_URL="mysql://sgifuenn_app:PASS@localhost:3306/sgifuenn_prod"

# Auth.js
AUTH_SECRET="<openssl rand -base64 32>"
AUTH_URL="https://sgi.fuenn.com"
AUTH_TRUST_HOST=true

# CRÍTICO para sesión cross-subdomain (sin esto, login en inscripciones
# no es visible en sgi y viceversa). El punto inicial es necesario.
COOKIE_DOMAIN=.fuenn.com

PUBLIC_HOST=inscripciones.fuenn.com
BACKOFFICE_HOST=sgi.fuenn.com
APP_URL=https://sgi.fuenn.com

UPLOADS_DIR=/home/<cpanel-user>/sgi-uploads
TESSDATA_DIR=/home/<cpanel-user>/sgi-tessdata
TESSERACT_LANG=spa

RESEND_API_KEY=<resend>
EMAIL_FROM="SGI - FuENN <noreply@fuenn.com>"
EMAIL_REPLY_TO="contacto@fuenn.com"

CRON_SECRET="<openssl rand -hex 32>"
```

> **Si en prod el admin queda atrapado en `inscripciones.fuenn.com` tras
> loguearse, lo más probable es que falte `COOKIE_DOMAIN=.fuenn.com`.**

---

## 11. Seeds

Ejecutar en este orden tras la primera migración:

```bash
npm run db:seed          # catálogos Anexos B–I + 3 users default + settings + provincias
npm run db:seed:geo      # GeoRef AR (provincias + localidades, tarda minutos)
npm run db:seed:demo     # datos demo (opcional para QA): 50 alumnos, 20 cursos, etc.
```

Los tres son **idempotentes** (upsert por claves naturales). Identificadores
demo:

- Alumnos demo: `username` = `90000001..50`, password `alumno`.
- Docentes demo: `username` = CUIT `99000000001..003`, password `docente`.
- Cursos demo: `abbr` empieza con `D-`.
- Instancias demo: `edition` entre `90001` y `99999`.
- Empresas demo: `name` empieza con `Empresa Demo`.

**Usuarios default** (del seed base, por requisito de la spec — cambiar
en cuanto deployes):

| user   | pass   | rol    |
| ------ | ------ | ------ |
| Admin  | admin  | admin  |
| Bedel  | bedel  | bedel  |
| Alumno | alumno | alumno |

---

## 12. Tests

### Unit (vitest)

```bash
npm run test
```

**25 tests** sin requerir DB. Stubs de `server-only` y env mínimo en
`vitest.setup.ts`. Archivos:

- `src/server/services/payment-ocr.test.ts` (4 casos básicos)
- `src/server/services/payment-ocr-edge.test.ts` (14 casos: variantes
  MP/Depósito/Rapipago, formatos AR vs US, "Referencia:", años de 2
  dígitos, falsos positivos, scores comparativos)
- `src/server/services/document-ocr.test.ts` (3 casos sobre
  `extractExpiryDate`: fecha más alta, separadores -./, sin match)
- `src/server/services/enrollment-code.test.ts` (4 casos sobre
  `generateEnrollmentCode`: formato `I-LCI5626-018`, padding,
  abbr largo, count=999)

Cuando agregues servicios puros (sin DB), agregales su `.test.ts`
hermano. Si el servicio depende de Prisma, podés mockear el cliente
o usar un schema SQLite para integración (requiere ajustes en
`schema.prisma`).

### E2E (playwright)

```bash
# en una terminal
npm run build && npm run start

# en otra
E2E_BASE_URL=http://localhost:3000 npm run test:e2e
```

`tests/e2e/smoke.spec.ts`: home, login, registro, redirect protegido,
health endpoint.

---

## 13. Bugs conocidos y limitaciones

1. **OCR de Tesseract es lento la primera vez** porque carga modelo.
   Mitigado: corre en `/api/upload` ya con el primer request. En prod
   conviene hacer un warmup post-deploy.
2. **`enrollments.closeWindow`** solo emite métrica. El enforcement
   real está en `enroll()`. Aceptable; si se quiere notificar al
   alumno N horas antes del cierre, hay que extender el handler.
3. **Header público con sesión** muestra "Mis inscripciones" /
   "Mi documentación" solo a alumnos. Para roles backoffice
   logueados que entren a `inscripciones.fuenn.com`, ven calendario
   + UserMenu (sin links a backoffice). El link "Inicio" sí los lleva
   a `/dashboard` cross-host (si `COOKIE_DOMAIN` está bien).
4. **Páginas backoffice de docente** (`/mis-cursos/*`) viven dentro
   de `(backoffice)/layout.tsx` (con sidebar que ya filtra por rol).
   La nav del docente muestra solo Dashboard + Mis cursos.
5. **Inbox de notificaciones** está bajo `(public)` para que sirva a
   cualquier rol; el header que aparece es el público. Si hay sesión
   muestra UserMenu, así que funciona pero un admin verá header
   "público" en esa pantalla. Aceptable para MVP.
6. **Vitest tiene warnings de CJS** de Vite — solo cosmético.
7. **`confirm()` nativo** sigue usándose en 8 lugares (empresas,
   mis-cursos, usuarios, alumnos, cronograma, cursos, mis-inscripciones,
   mi-documentacion). Funciona pero bloquea el hilo y no respeta el
   theme. Reemplazo por `AlertDialog` está pendiente.
8. **Mutations en backoffice sin `onError`**: varias `mutate(...)`
   directas (approve/reject/reset.mutate) no muestran toast al
   usuario en caso de error — solo log a consola. Falta cablear
   `toast.error` en su `onError`.
9. **`acceptOffer` (lista de espera) sin lock pesimista**: a
   diferencia de `enroll()`, no usa `SELECT ... FOR UPDATE` sobre
   la instancia. El riesgo es marginal porque cada offer solo se
   acepta una vez (status pending→accepted), pero si quisieras
   blindarlo, aplicar el mismo patrón que `enroll`.

---

## 14. Próximos pasos sugeridos / pendientes

Por prioridad estimada:

**UX / quick wins**
- **Reemplazar `confirm()` por AlertDialog** en los 8 lugares listados
  en sección 13. Mismo patrón que ya usamos con Dialog para forms.
- **Cablear `toast.error` en `onError`** de las mutations backoffice
  (`approve.mutate`, `reject.mutate`, `reset.mutate`, etc.).
- **Aplicar pill X/Y a `/catalogos`**: el `CatalogEditor` genérico
  necesita prop `total/filtered`.

**Funcional**
- **Notificaciones más ricas**: agrupar por tipo, paginación, link al
  recurso relacionado (inscripción/documento/pago).
- **`enrollments.closeWindow`**: pasar de métrica a enviar
  recordatorio al alumno N horas antes del cierre.

**Seguridad / hardening**
- **Rate limit en `/api/upload`** (en `docs/security-checklist.md`
  pendiente).
- **Habilitar 2FA opcional** para roles backoffice.
- **`acceptOffer` con lock pesimista** (paralelo a `enroll`).
- **Auditar otros endpoints que devuelvan User**: estuvo todo
  cubierto con `userPublicSelect`, pero si se agregan endpoints
  nuevos hay que recordar usar ese select.

**Operacional**
- **Reverse proxy headers**: verificar que Apache pasa `X-Forwarded-*`
  para que `headers().get("host")` devuelva el host real en
  `after-login` y otros server components que dependen.
- **Borrar rama remota `claude/analyze-specs-plan-sprints-DNPnb`**: el
  agente no tiene permisos vía `git push --delete` (HTTP 403).
  Hacerlo desde GitHub UI.
- **Warmup OCR post-deploy** (Tesseract): pegar un POST a `/api/upload`
  con un archivo demo para cargar el modelo en memoria antes del primer
  alumno.

**Otros**
- **Internacionalización**: hoy todo es es-AR hardcodeado.

---

## 15. Comandos útiles

```bash
# Dev local
npm run dev                      # next dev :3000
npm run prisma:studio            # GUI de la DB
npm run prisma:migrate -- --name xxx   # nueva migración (dev)

# Build / typecheck / lint
npm run build
npm run typecheck
npm run lint

# Prod
npm run prisma:deploy            # aplicar migraciones sin prompt
npm run start

# Storage (dev)
ls uploads/                      # archivos guardados

# Cron manual
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://sgi.fuenn.com/api/cron/documents.markExpiringSoon
```

### Hosts locales (`/etc/hosts`)

```
127.0.0.1 inscripciones.localhost
127.0.0.1 sgi.localhost
```

Acceder con `http://inscripciones.localhost:3000` y `http://sgi.localhost:3000`.

---

## 16. Decisiones de producto / técnicas relevantes

- **Storage privado fuera del webroot**: `UPLOADS_DIR` no debe estar
  bajo `public/`. Apache/cPanel no tiene Alias a esa ruta. Las
  descargas pasan por `/api/files/[...]` con auth.
- **Snapshot inmutable de documentación al inscribirse**: cuando un
  alumno se inscribe, se copia su doc vigente a
  `EnrollmentDocumentSnapshot`. Las versiones rechazadas se conservan
  en `DocumentVersion` (sin purga).
- **Empresas sugeridas**: cuando el alumno propone una empresa nueva al
  inscribirse, se crea con `status: pending_approval`. El bedel la
  aprueba desde `/empresas` pestaña Pendientes.
- **Autovalidación de documentación**: si `enrollment.autoValidateDocs`
  está on y el OCR del doc retorna `typeMatched=true` y `score >=
  documents.minOcrScore`, el doc queda `aprobada` con nota.
- **Cookies cross-subdomain**: las cookies se setean con
  `Domain=.fuenn.com` cuando `COOKIE_DOMAIN` está presente. Los
  nombres usan prefijo `__Secure-` en prod (no `__Host-` porque
  `__Host-` no admite `Domain`).
- **Lista de espera** con oferta por email + ventana de 48 hs
  configurable (`waitlist.offerWindowHours`).
- **Código de inscripción** `I-{ABBR}{edition}-{NNN}` generado
  transaccional por `enrollment-code.ts`.

---

## 17. Cómo retomar en otra sesión

1. Leer este `docs/HANDOFF.md`.
2. `git pull origin main` (estás en `main`, sino avisar y no tocar).
3. `cat docs/runbook.md` si necesitás contexto operativo.
4. Para entender estructura de un router: empezar por
   `src/server/trpc/root.ts`.
5. Antes de codear: chequear que `npm run build` pasa en limpio.
6. Para cualquier cambio:
   - Editar en `main`.
   - Commit con mensaje claro (formato: `<tema>: <resumen>` + body).
   - Push directo a `origin main` (no abrir PR salvo que el cliente
     lo pida explícitamente).
   - Confirmar el hash al cliente.
7. Recordar: **producción solo deploya `main`**. Cualquier rama
   alternativa **no llega a prod** hasta mergear.

---

**Fin del handoff.**
