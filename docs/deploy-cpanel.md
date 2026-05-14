# Deploy en VPS AlmaLinux + cPanel/WHM

> Sistema: Next.js 15 (App Router) + tRPC + Prisma + MySQL.
> Hosting: VPS propio AlmaLinux con cPanel/WHM. Sin pipeline CI/CD;
> deploy manual por SSH.

## 1. Pre-requisitos en el VPS

1. **Node 20.x o 22.x** instalado (vía cPanel "Setup Node.js App" o NodeSource).
2. **MySQL 8** corriendo localmente (cPanel ya lo provee).
3. **PM2** global (`npm i -g pm2`) si querés correr fuera de "Setup Node.js App".
4. **Subdominios DNS** apuntando al VPS:
   - `inscripciones.fuenn.com`
   - `sgi.fuenn.com`
5. **SSL** (AutoSSL de cPanel) emitido para ambos subdominios.

## 2. Crear la base y el usuario MySQL

Desde **cPanel → MySQL Databases**:

- Crear DB: `sgifuenn_prod`
- Crear user: `sgifuenn_app` con password fuerte
- Asignar el user a la DB con TODOS los privilegios

## 3. Estructura recomendada en el server

```
/home/<cpanel-user>/
├── apps/
│   └── sgi/                 # checkout del repo
├── sgi-uploads/             # storage privado, fuera del webroot (chmod 700)
└── sgi-tessdata/            # cachés de Tesseract
```

> **Importante**: `sgi-uploads/` y `sgi-tessdata/` NO deben tener un
> Alias en Apache. Toda descarga se sirve por `/api/files/[...]`.

## 4. Variables de entorno

Crear `/home/<cpanel-user>/apps/sgi/.env.production` con:

```env
NODE_ENV=production
DATABASE_URL="mysql://sgifuenn_app:PASSWORD@localhost:3306/sgifuenn_prod"
AUTH_SECRET="$(openssl rand -base64 32)"
AUTH_URL="https://sgi.fuenn.com"
AUTH_TRUST_HOST=true
PUBLIC_HOST=inscripciones.fuenn.com
BACKOFFICE_HOST=sgi.fuenn.com
APP_URL=https://sgi.fuenn.com
UPLOADS_DIR=/home/<cpanel-user>/sgi-uploads
TESSDATA_DIR=/home/<cpanel-user>/sgi-tessdata
TESSERACT_LANG=spa
RESEND_API_KEY="..."
EMAIL_FROM="SGI - FuENN <noreply@fuenn.com>"
EMAIL_REPLY_TO="contacto@fuenn.com"
CRON_SECRET="$(openssl rand -hex 32)"
```

## 5. Build y migraciones

```bash
cd /home/<cpanel-user>/apps/sgi
npm ci
npm run prisma:generate
# Primera vez:
npx prisma migrate deploy
npm run db:seed
# Builds posteriores:
npm run build
```

## 6. Levantar la app

### Opción A — "Setup Node.js App" de cPanel

- Application root: `/home/<cpanel-user>/apps/sgi`
- Application URL: dejar vacío (vamos a poner reverse-proxy aparte)
- Application startup file: `node_modules/next/dist/bin/next` con args
  `start -p 3001`. **Alternativa más simple**: crear `server.js` con
  `require("child_process").spawn("npm", ["start"], { stdio: "inherit" })`.
- Variables de entorno: cargar las del `.env.production`.

### Opción B — PM2

```bash
pm2 start "npm run start" --name sgi --cwd /home/<cpanel-user>/apps/sgi -- -p 3001
pm2 save
pm2 startup
```

## 7. Reverse proxy en Apache

Para cada subdominio, en cPanel **Domains → Subdomains** crear los dos
subdominios apuntando a `/public_html/sgi-empty` (carpeta vacía; toda
la app se sirve vía proxy, no desde document root).

Luego crear `.htaccess` en esa carpeta:

```apache
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}/$1 [R=301,L]

RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ http://127.0.0.1:3001/$1 [P,L]
```

Habilitar mod_proxy si no está activo (WHM → EasyApache 4 → Profile).

## 8. Tareas programadas (cron)

Desde **cPanel → Cron Jobs**, agregar (todas POST con secret):

```
# Cada hora — vencimiento y cierre
0 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://sgi.fuenn.com/api/cron/documents.markExpiringSoon > /dev/null
5 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://sgi.fuenn.com/api/cron/documents.markExpired > /dev/null
10 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://sgi.fuenn.com/api/cron/enrollments.closeWindow > /dev/null
15 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://sgi.fuenn.com/api/cron/waitlist.expireOffers > /dev/null
20 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://sgi.fuenn.com/api/cron/notifications.expire > /dev/null
```

Reemplazar `$CRON_SECRET` con el valor real del `.env.production`.

## 9. Backups

- **DB**: cron diario `mysqldump sgifuenn_prod > backups/db-$(date +%F).sql.gz`
  con rotación de 14 días.
- **Storage**: `tar` o `rsync` diario de `/home/<cpanel-user>/sgi-uploads`
  hacia un volumen externo / Backblaze.

## 10. Deploy de actualizaciones

```bash
ssh <cpanel-user>@<vps>
cd ~/apps/sgi
git pull
npm ci
npx prisma migrate deploy
npm run build
pm2 restart sgi      # o "Restart" desde Setup Node.js App
```

## 11. Advertencias importantes

- Las contraseñas `admin/admin`, `bedel/bedel`, `alumno/alumno` del seed
  **deben cambiarse en cuanto la app esté en línea**. La spec las pide
  literales pero son inseguras para producción.
- El directorio `sgi-uploads/` debe estar **fuera del DocumentRoot** y
  con permisos 700. Verificar con:
  ```bash
  curl -I https://sgi.fuenn.com/sgi-uploads/anything   # debería dar 404
  ```
- Verificar que **DKIM y SPF** estén configurados para `fuenn.com` en
  Resend antes del go-live; si no, los emails irán a spam.
