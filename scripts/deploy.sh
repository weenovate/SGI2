#!/usr/bin/env bash
# Deploy SGI - corre desde la raíz del proyecto en el VPS.
#
# Requiere: node 20+, pm2 global, .env.production presente.
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/apps/sgi}"
PM2_NAME="${PM2_NAME:-sgi}"

cd "$APP_DIR"

echo "==> pulling latest..."
git fetch --all
git reset --hard origin/main

echo "==> installing deps..."
npm ci

echo "==> generating prisma client..."
npx prisma generate

echo "==> applying DB migrations..."
npx prisma migrate deploy

echo "==> building..."
NODE_ENV=production npm run build

echo "==> restarting PM2..."
if pm2 describe "$PM2_NAME" > /dev/null 2>&1; then
  pm2 restart "$PM2_NAME" --update-env
else
  pm2 start "npm run start" --name "$PM2_NAME"
fi
pm2 save

echo "==> done."
