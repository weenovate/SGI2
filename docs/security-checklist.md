# Checklist de seguridad — SGI

Revisión a aplicar antes del go-live y de cada release.

## Acceso y autenticación

- [ ] Contraseñas default (`admin/admin`, `bedel/bedel`, `alumno/alumno`) **rotadas**.
- [ ] `AUTH_SECRET` ≥ 32 caracteres (generado con `openssl rand -base64 32`).
- [ ] `CRON_SECRET` único y solo conocido por el servidor.
- [ ] HTTPS forzado en ambos subdominios (AutoSSL emitido).
- [ ] Bloqueo por intentos fallidos verificado (5 intentos → 15 min).

## Datos

- [ ] `DATABASE_URL` no expuesta en logs.
- [ ] `.env*` excluidos por `.gitignore` y no commiteados.
- [ ] Backups automáticos diarios verificados (DB + storage).
- [ ] Encriptación en reposo del disco del VPS (cPanel suele ofrecerlo).

## Storage privado

- [ ] `UPLOADS_DIR` está **fuera del webroot** (verificar con `curl -I` que
      devuelva 404).
- [ ] Permisos 700 en `~/sgi-uploads` y subdirectorios.
- [ ] Las descargas pasan exclusivamente por `/api/files/[...]`.
- [ ] Archivos guardados con UUID en disco; nombre original solo en DB.

## Headers

- [x] `X-Content-Type-Options: nosniff`
- [x] `X-Frame-Options: SAMEORIGIN`
- [x] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] HSTS configurado en Apache (`Header always set Strict-Transport-Security ...`).

## Cookies y sesiones

- [ ] Cookies `Secure` y `HttpOnly` (Auth.js v5 lo hace por defecto en HTTPS).
- [ ] Expiración configurable desde panel (`security.sessionExpiryHours`).

## Email

- [ ] Dominio `fuenn.com` con SPF, DKIM y DMARC.
- [ ] `RESEND_API_KEY` sin permisos de admin global; alcance limitado al dominio.
- [ ] Bounces revisados periódicamente en Resend.

## OCR / uploads

- [ ] Validación de MIME y tamaño en server (no solo en cliente).
- [ ] Path traversal bloqueado (verificado en `lib/storage.safeAbs`).
- [ ] Rate limit en `/api/upload` — *pendiente: instalar middleware si el
      tráfico anónimo (alumnos) crece*.

## Auditoría

- [ ] Auditoría activa para todas las mutaciones (verificado con
      `/auditoria` después de crear/modificar/eliminar).
- [ ] Export XLSX funcionando.

## Soft-delete

- [ ] Tipografía roja visible para Admin en cada listado.
- [ ] Restauración funcionando para usuarios/cursos/instancias/docs/empresas.

## Operacional

- [ ] Plan de respuesta a incidentes documentado (a quién avisar si cae el VPS).
- [ ] Cuenta de admin de respaldo (no usar la cuenta personal).
- [ ] Logs de PM2 rotando (`pm2 install pm2-logrotate`).
