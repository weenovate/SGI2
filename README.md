# SGI - Sistema de Gestión de Inscripciones (FuENN)

Aplicación web para la gestión de inscripciones de un instituto de
capacitación marítima. Provee un calendario público de cursos
(`inscripciones.fuenn.com`) y un backoffice operativo
(`sgi.fuenn.com`) bajo un único proyecto Next.js.

> **Spec original**: `Especificaciones_SGI_Mayo2026.docx`
> **Plan / sprints**: ver el plan aprobado del proyecto.

## Stack

- **Next.js 15** (App Router) + React 19 + TypeScript
- **tRPC** para la API tipada
- **Prisma + MySQL** como base de datos
- **Auth.js (NextAuth v5)** con credenciales y magic-link por email
- **Tailwind CSS + shadcn/ui** para la UI
- **Resend** para email transaccional
- **Tesseract.js + sharp** para OCR/IA de documentación y comprobantes
- **Storage local** privado (fuera del webroot, servido por
  `/api/files/[...]` con validación de sesión + permisos)
- **Hosting**: VPS AlmaLinux + cPanel/WHM, Node vía PM2 o
  "Setup Node.js App", reverse-proxy Apache. Sin pipeline CI/CD.

## Roles

| Rol      | Acceso                                                              |
| -------- | ------------------------------------------------------------------- |
| admin    | Control total, configuración, auditoría, restauración, usuarios     |
| bedel    | CRUDs operativos, aprueba/rechaza inscripciones y documentación     |
| manager  | Solo lectura ejecutiva — dashboards, KPIs, exports                  |
| docente  | Sus instancias, alumnos, asistencia y calificaciones                |
| alumno   | Calendario, mis inscripciones, mi documentación, mis datos, dash    |

## Setup local

```bash
cp .env.example .env
# Completar DATABASE_URL, AUTH_SECRET, etc.

npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run db:seed
npm run dev
```

Para probar el ruteo multi-host en local, agregar a `/etc/hosts`:

```
127.0.0.1 inscripciones.localhost
127.0.0.1 sgi.localhost
```

Luego abrir:

- `http://inscripciones.localhost:3000` → calendario público
- `http://sgi.localhost:3000` → backoffice

## Usuarios por defecto (seed)

> Pedidos literalmente por la spec. **Cambiar inmediatamente al
> deployar a producción.**

| usuario  | password | rol    |
| -------- | -------- | ------ |
| Admin    | admin    | admin  |
| Bedel    | bedel    | bedel  |
| Alumno   | alumno   | alumno |

## Estructura

```
prisma/                # schema Prisma + seed
src/
├── app/
│   ├── (public)/       # inscripciones.fuenn.com
│   ├── (backoffice)/   # sgi.fuenn.com
│   └── api/
│       ├── trpc/[trpc]/
│       ├── auth/[...nextauth]/
│       ├── files/[...path]/    # servidor de archivos privados
│       └── cron/[task]/        # disparado por cron de cPanel
├── server/trpc/        # routers de dominio
├── lib/                # auth, db, storage, email, audit, env, ocr
├── components/         # UI shadcn + compartidos
└── middleware.ts       # ruteo por host
docs/
└── deploy-cpanel.md    # runbook de deploy en VPS + cPanel
uploads/                # storage privado (gitignored)
```

## Scripts

```
npm run dev               # dev server
npm run build             # build de producción
npm run start             # start de producción
npm run typecheck         # tsc --noEmit
npm run lint              # next lint
npm run prisma:migrate    # crear migración (dev)
npm run prisma:deploy     # aplicar migraciones (prod)
npm run db:seed           # poblar catálogos + usuarios default
npm run test              # vitest
npm run test:e2e          # playwright
```

## Deploy

Ver [`docs/deploy-cpanel.md`](docs/deploy-cpanel.md).
