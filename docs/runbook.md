# Runbook operacional — SGI / FuENN

Guía rápida para mantener el sistema en producción.

---

## 1. Acceso al servidor

```bash
ssh <cpanel-user>@<vps-host>
cd ~/apps/sgi
```

- Logs de PM2: `pm2 logs sgi`
- Estado: `pm2 status`
- Reiniciar: `pm2 restart sgi`

## 2. Usuarios por defecto

El seed crea (HU spec):

| usuario | password | rol    |
| ------- | -------- | ------ |
| Admin   | admin    | admin  |
| Bedel   | bedel    | bedel  |
| Alumno  | alumno   | alumno |

> **Acción inmediata post-deploy**: cambiar las tres contraseñas desde
> el panel `/usuarios` (admin) y `/mis-datos` (alumno). Documentar en
> el gestor de credenciales del instituto.

## 3. Tareas programadas (cron)

Configuradas desde cPanel → Cron Jobs. Cada una pega a
`/api/cron/<task>` con `Authorization: Bearer $CRON_SECRET`.

| Tarea                              | Frecuencia | Descripción                                                |
| ---------------------------------- | ---------- | ---------------------------------------------------------- |
| `documents.markExpiringSoon`       | hora       | Marca docs con tag "Vence pronto" (30 días configurable).  |
| `documents.markExpired`            | hora       | Mueve docs vencidas a estado `vencida`.                    |
| `enrollments.closeWindow`          | hora       | Métrica de instancias que cierran inscripción próximamente.|
| `waitlist.expireOffers`            | hora       | Expira ofertas pendientes de lista de espera (48 hs).      |
| `notifications.expire`             | diario     | Soft-elimina notificaciones con `expiresAt` vencido.       |

Comando de verificación manual:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://sgi.fuenn.com/api/cron/documents.markExpiringSoon
```

## 4. Backups

### Base de datos

Cron diario (4:00 AM):

```bash
mysqldump --single-transaction --routines --triggers sgifuenn_prod \
  | gzip > ~/backups/db-$(date +%F).sql.gz
find ~/backups -name "db-*.sql.gz" -mtime +14 -delete
```

### Storage de archivos

Cron diario (4:30 AM):

```bash
tar -czf ~/backups/uploads-$(date +%F).tar.gz ~/sgi-uploads
find ~/backups -name "uploads-*.tar.gz" -mtime +14 -delete
```

Restore: descomprimir el `.sql.gz` con `gunzip` y restaurar con
`mysql sgifuenn_prod < db-YYYY-MM-DD.sql`. El tarball del storage
se descomprime en `~/sgi-uploads` (verificar permisos 700).

## 5. Deploy de actualizaciones

```bash
cd ~/apps/sgi
git pull
npm ci
npx prisma migrate deploy
npm run build
pm2 restart sgi
```

Si la migración requiere downtime:

1. Mostrar mensaje de mantenimiento (cambiar el `.htaccess` por uno
   con `503` durante 1-5 minutos).
2. Correr `npx prisma migrate deploy`.
3. Hacer `pm2 restart sgi`.
4. Restaurar `.htaccess`.

## 6. Manejo de errores comunes

### "Cannot find module" o build roto

```bash
rm -rf node_modules .next
npm ci
npm run build
```

### Email no llega

1. Verificar `RESEND_API_KEY` en `.env.production`.
2. Revisar dashboard de Resend para ver bounce/spam.
3. Confirmar DKIM/SPF/DMARC del dominio `fuenn.com`.
4. Revisar `notifications.enabled` en panel de configuración.

### OCR muy lento

Tesseract corre en el server. El primer pedido es lento (carga
modelo). Para mitigarlo, después del deploy:

```bash
curl -F "files=@/tmp/test.jpg" \
  -H "Cookie: <auth-cookie>" \
  https://sgi.fuenn.com/api/upload?bucket=documents
```

## 7. Restauración de soft-deletes

Las entidades borradas son visibles para el admin con tipografía
**roja** en cada listado. El botón "Restaurar" devuelve el registro
al estado anterior. Funciona para usuarios, cursos, instancias,
documentos, empresas, catálogos y notificaciones.

## 8. Bloqueo de usuarios

El sistema bloquea automáticamente tras 5 intentos fallidos por 15
minutos (ambos valores en el panel de configuración → Seguridad).

Para desbloquear manualmente desde la base de datos:

```sql
UPDATE User SET failedAttempts = 0, lockedUntil = NULL WHERE username = 'XXX';
```

## 9. Tests

```bash
# Unit tests
npm run test

# E2E (requiere `npm run start` corriendo en :3000)
E2E_BASE_URL=http://localhost:3000 npm run test:e2e
```

## 10. Checklist de go-live

- [ ] DNS de `inscripciones.fuenn.com` y `sgi.fuenn.com` apuntando al VPS.
- [ ] AutoSSL emitido para ambos subdominios.
- [ ] `.env.production` con `AUTH_SECRET` generado (`openssl rand -base64 32`).
- [ ] DB creada y migraciones aplicadas (`prisma migrate deploy`).
- [ ] Seed corrido (`npm run db:seed`).
- [ ] GeoRef AR cargado (`npm run db:seed:geo`).
- [ ] Contraseñas default cambiadas.
- [ ] PM2 con `pm2 startup` y `pm2 save`.
- [ ] Cron jobs configurados con `CRON_SECRET` real.
- [ ] Resend con dominio verificado y DKIM/SPF activos.
- [ ] Backups automáticos verificados (correr una vez y revisar archivos).
- [ ] Smoke tests E2E pasando.
- [ ] Logo y branding revisados en `/login`, `/calendario`, sidebar y emails.
- [ ] Panel de configuración con datos bancarios reales y términos/privacidad.

## 11. Contactos

- Soporte técnico / dev: anotar aquí responsable post-handoff.
- DBA del VPS: cPanel admin.
- DNS: panel del registrador del dominio fuenn.com.
