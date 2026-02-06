# Despliegue en Railway

## Comandos recomendados

| Fase   | Comando |
|--------|--------|
| **Build** | `npx prisma generate && npm run build` |
| **Start** | `npm start` (por defecto) o `npm run start:prod` |

`postinstall` en `package.json` ejecuta `prisma generate` tras `npm install`, por lo que el Build puede ser solo `npm run build` si prefieres.

## Variables de entorno (copiar a Railway)

Configura estas variables en el panel de Railway (Variables):

```env
# Obligatorias
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
JWT_SECRET=una-cadena-larga-y-aleatoria-en-produccion

# Producción: URL pública del API (para cookies, links de imágenes, logs)
BASE_URL=https://tu-app.up.railway.app

# CORS: URL(es) del frontend que consumirá esta API (una o varias separadas por coma)
CORS_ORIGIN=https://tu-frontend.vercel.app
# O varios orígenes:
# CORS_ORIGINS=https://tu-frontend.vercel.app,https://www.tu-frontend.vercel.app

# Opcionales
NODE_ENV=production
PORT=3000
JWT_ACCESS_EXPIRES_IN=3600
ALLOWED_IMAGE_DOMAINS=tu-cdn.com,tu-frontend.vercel.app
APPOINTMENTS_TIMEZONE=America/Mexico_City

# WhatsApp (si usas OTP/notificaciones por Meta Cloud API)
# WHATSAPP_ACCESS_TOKEN=...
```

### Resumen por variable

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `DATABASE_URL` | Sí | URL de PostgreSQL (Railway ofrece Postgres y la inyecta) |
| `JWT_SECRET` | Sí | Clave para firmar JWTs; usar valor largo y aleatorio |
| `BASE_URL` | Recomendada en prod | URL base del API (ej. `https://api.midominio.com`) |
| `CORS_ORIGIN` o `CORS_ORIGINS` | Sí para frontend externo | Origen(es) permitidos para CORS (URL del frontend) |
| `NODE_ENV` | Opcional | `production` en Railway |
| `PORT` | No | Railway la asigna; la app usa `process.env.PORT` |
| `JWT_ACCESS_EXPIRES_IN` | Opcional | Segundos (default 3600) |
| `ALLOWED_IMAGE_DOMAINS` | Opcional | Dominios para URLs de imágenes (separados por coma) |
| `APPOINTMENTS_TIMEZONE` | Opcional | Zona horaria para citas (default `America/Mexico_City`) |
| `WHATSAPP_ACCESS_TOKEN` | Opcional | Token de Meta WhatsApp Cloud API |

## Notas

- **PostgreSQL:** Crea un servicio Postgres en Railway y enlaza el proyecto; `DATABASE_URL` se suele añadir automáticamente.
- **Migraciones:** Ejecuta migraciones antes del primer deploy o en un job: `npx prisma migrate deploy`.
- **Seed:** Si necesitas datos iniciales: `npx prisma db seed` (ejecutar una vez manualmente o en un script de deploy).
