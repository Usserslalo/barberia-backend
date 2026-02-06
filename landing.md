# API Landing Page — JC BARBER SHOP

Documentación de los endpoints públicos de la landing. Base URL: `{BASE_URL}/api`. Rutas bajo **`/api/landing/`**. No requieren autenticación.

---

## CORS (anti-leeching)

Solo los dominios autorizados pueden consumir estas APIs. Se usa la variable de entorno **`CORS_ORIGIN`** (un origen) o **`CORS_ORIGINS`** (varios orígenes separados por coma). Si no se define ninguna, por defecto se permite `http://localhost:4200`. Cualquier otro origen recibe respuesta sin header `Access-Control-Allow-Origin` (el navegador bloquea el acceso), evitando que terceros usen los datos de barberos en sus propios sitios.

**Ejemplo .env:**
- Un origen: `CORS_ORIGIN=https://jcbarbershop.com`
- Varios: `CORS_ORIGINS=https://jcbarbershop.com,https://www.jcbarbershop.com`

---

## Índice de endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/landing` | Datos completos de la landing (config, barbers, services, gallery) |
| GET | `/api/landing/barbers` | Solo barberos activos (misma fuente que la sección Nuestro equipo) |

---

## Esquema de datos optimizado

La respuesta de **GET /api/landing** sigue una estructura anidada pensada para alimentar cada sección de la web:

- **config:** Objeto único con Hero, About, Contacto/Ubicación y **`status`** (open/closed). El front puede mapearlo a:
  - **Hero:** `config.heroTitle`, `config.heroBackgroundImage`, `config.logoUrl`
  - **About:** `config.aboutTitle`, `config.aboutText`, `config.aboutImageUrl`
  - **Contacto / mapa:** `config.phone`, `config.email`, `config.instagramUrl`, `config.whatsappUrl`, `config.latitude`, `config.longitude`, `config.address`, `config.googleMapsIframe`
  - **Navegación (campo calculado):** `config.navigationUrl` — Enlace universal para abrir la ubicación en Google Maps o Waze desde el móvil: `https://www.google.com/maps/search/?api=1&query={lat},{lng}`. Solo está presente cuando la config tiene `latitude` y `longitude`; si no hay coordenadas, el campo no se incluye o es `null`.
  - **Estado en tiempo real:** `config.status` — `"open"` | `"closed"` según la hora actual del servidor y los horarios de barberos (BarberWorkSchedule) y excepciones (ScheduleException: CLOSED, HOLIDAY). El front puede mostrar “Abierto” / “Cerrado” sin lógica adicional. La hora usada es la del servidor (zona horaria del host).
- **barbers:** Array de barberos con `isActive: true`, ordenados por `displayOrder` y `name`.
- **services:** Array de servicios activos con categoría resuelta (nombre desde `ServiceCategory` o `"General"`).
- **gallery:** Array de ítems de galería ordenados por **fecha de creación descendente** (`createdAt` desc). Opcionalmente paginable con query params.

Estructura equivalente para el front (mapeo desde `config`):

```ts
{
  hero:    { heroTitle, heroBackgroundImage, logoUrl },
  about:   { aboutTitle, aboutText, aboutImageUrl },
  contact: { phone, email, instagramUrl, whatsappUrl, latitude, longitude, address, googleMapsIframe, navigationUrl },
  services: [...],
  barbers: [...],
  gallery: [...]
}
```

---

## Caché y rate limit

- **Caché en servidor:** La respuesta de **GET /api/landing** (sin query params) se cachea en memoria (CacheModule). TTL: **5 minutos**. La respuesta de **GET /api/landing/barbers** se cachea solo cuando no se envían parámetros de imagen (`width`, `height`, `format`); si se envían, la respuesta es siempre fresca para aplicar las transformaciones correctas. La caché se invalida al actualizar config, barbers, services o galería desde el panel admin. **Si el almacén de caché falla, la API sigue respondiendo con datos frescos** (no se produce caída del servidor).
- **Caché en navegador:** Todas las respuestas de landing incluyen el header **`Cache-Control: public, max-age=60`** (1 minuto). El navegador puede reutilizar la respuesta sin volver a pedirla al servidor durante 60 segundos.
- **Rate limit:** **60 peticiones por minuto** por IP para ambos endpoints (más permisivo que Auth, preventivo frente a scraping). Al superar el límite: **429** con `code: 'THROTTLED'`.

---

## Optimización de imágenes (Cloudinary / WebP)

Los campos **photoUrl** (barberos) e **imageUrl** (galería), y las URLs de **config** (heroBackgroundImage, logoUrl, aboutImageUrl), admiten parámetros de transformación cuando las imágenes están en **Cloudinary**:

- **GET /api/landing?width=500** — Añade ancho 500 (y crop fill) a las URLs de Cloudinary.
- **GET /api/landing?width=500&height=500&format=webp** — Ancho, alto y formato WebP.

Si las imágenes están en **AWS S3** u otro CDN sin transformación en URL, el API no modifica las URLs; se recomienda servir versiones optimizadas (p. ej. WebP) desde el CDN (Lambda@Edge, CloudFront, etc.) y documentarlo en el front.

**Query params de imagen (opcionales):**

| Parámetro | Valores | Descripción |
|-----------|---------|-------------|
| `width` | number | Ancho deseado (Cloudinary: w_N). |
| `height` | number | Alto deseado (Cloudinary: h_N, c_fill). |
| `format` | `webp` \| `auto` | Formato: WebP o auto (Cloudinary elige el mejor). |

Solo se transforman URLs cuyo host sea `res.cloudinary.com` o `upload.cloudinary.com`. El resto se devuelven sin cambios.

---

## GET `/api/landing`

Devuelve todos los datos necesarios para renderizar la landing: configuración (Hero, About, Contacto, **status** open/closed), barberos activos, servicios activos y galería. Pensado para una única carga inicial o SSR.

**Secciones que alimenta:** Hero, About, Nuestro equipo (barbers), Servicios, Galería, Contacto/Mapa, estado Abierto/Cerrado.

**Headers**

| Header | Valor |
|--------|--------|
| (ninguno requerido) | No requiere Authorization |
| **Respuesta** | `Cache-Control: public, max-age=60` (caché en navegador 1 min) |

**Query params**

| Parámetro | Tipo | Obligatorio | Descripción |
|----------|------|-------------|-------------|
| `galleryLimit` | number | No | Límite de ítems de galería (paginación). Máximo **100**; si se excede se capa a 100. Mínimo 1 si se envía. |
| `galleryOffset` | number | No | Offset para galería (≥ 0). La galería está ordenada por `createdAt` desc. |
| `width` | number | No | Ancho deseado para URLs de imágenes (Cloudinary). |
| `height` | number | No | Alto deseado para URLs de imágenes (Cloudinary). |
| `format` | `webp` \| `auto` | No | Formato de imagen: webp o auto (Cloudinary). |

Cuando se usan `galleryLimit`, `galleryOffset` o parámetros de imagen, la respuesta **no se cachea en servidor** (solo se cachea la respuesta sin query params). Los fallos de caché no rompen la petición: si el servidor no puede leer o escribir caché, responde igual con datos frescos.

**Responses**

| Código | Descripción |
|--------|-------------|
| **200** | OK. Body: objeto con `config`, `barbers`, `services`, `gallery`. |
| **404** | Configuración del landing no encontrada (ejecutar seed). |
| **429** | Too Many Requests. Límite 60 req/min. |

**Ejemplo de response body (estructura optimizada)**

```json
{
  "config": {
    "id": "11111111-1111-1111-1111-111111111111",
    "status": "open",
    "heroTitle": "JC BARBER SHOP",
    "heroBackgroundImage": "https://...",
    "logoUrl": "https://...",
    "aboutTitle": "Sobre nosotros",
    "aboutText": "Texto de la sección...",
    "aboutImageUrl": "https://...",
    "phone": "+52 55 1234 5678",
    "email": "contacto@jcbarbershop.com",
    "instagramUrl": "https://instagram.com/...",
    "whatsappUrl": "https://wa.me/...",
    "whatsappPhoneId": null,
    "whatsappWabaId": null,
    "latitude": 19.4326,
    "longitude": -99.1332,
    "address": "Ciudad de México, México",
    "googleMapsIframe": null,
    "navigationUrl": "https://www.google.com/maps/search/?api=1&query=19.4326,-99.1332",
    "updatedAt": "2026-02-04T12:00:00.000Z"
  },
  "barbers": [
    {
      "id": "uuid",
      "name": "Carlos",
      "roleDescription": "Top Barber",
      "bio": "Biografía corta...",
      "photoUrl": "https://...",
      "experienceYears": 5,
      "displayOrder": 0,
      "isActive": true
    }
  ],
  "services": [
    {
      "id": "uuid",
      "name": "Corte Clásico",
      "description": "Corte tradicional.",
      "price": 150,
      "durationMinutes": 30,
      "category": "Corte",
      "categoryId": "uuid-cat",
      "isActive": true
    }
  ],
  "gallery": [
    {
      "id": "uuid",
      "imageUrl": "https://...",
      "description": "Descripción opcional",
      "createdAt": "2026-02-04T10:00:00.000Z"
    }
  ]
}
```

- **Barberos:** Solo con `isActive: true`, orden por `displayOrder` asc y `name` asc. El campo **`photoUrl` nunca es null**: si en BD está vacío o no existe, se devuelve una URL de imagen placeholder para que el front no tenga que comprobar null.
- **Servicios:** Solo activos; `category` es el nombre de la categoría (o `"General"`).
- **Galería:** Orden por `createdAt` desc. Si se envían `galleryLimit` y/o `galleryOffset`, se aplica paginación en memoria (`galleryLimit` máx. 100).

---

## GET `/api/landing/barbers`

Lista solo los barberos activos. Misma fuente que la sección "Nuestro equipo" de la landing. Pensado para el wizard de reserva (mostrar las mismas fotos que en la landing).

**Sección que alimenta:** Nuestro equipo / selector de barbero en reserva.

**Headers**

| Header | Valor |
|--------|--------|
| (ninguno requerido) | No requiere Authorization |
| **Respuesta** | `Cache-Control: public, max-age=60` (caché en navegador 1 min) |

**Query params**

| Parámetro | Tipo | Obligatorio | Descripción |
|----------|------|-------------|-------------|
| `width` | number | No | Ancho para photoUrl (Cloudinary). |
| `height` | number | No | Alto para photoUrl (Cloudinary). |
| `format` | `webp` \| `auto` | No | Formato de imagen (Cloudinary). |

**Responses**

| Código | Descripción |
|--------|-------------|
| **200** | OK. Body: array de barberos. |
| **429** | Too Many Requests. Límite 60 req/min. |

**Ejemplo de response body**

```json
[
  {
    "id": "uuid",
    "name": "Carlos",
    "roleDescription": "Top Barber",
    "bio": "Biografía corta...",
    "photoUrl": "https://...",
    "experienceYears": 5,
    "displayOrder": 0,
    "isActive": true
  }
]
```

- **Filtro:** Solo barberos con `isActive: true`.
- **Orden:** `displayOrder` asc, luego `name` asc.
- **photoUrl:** Nunca es null; si en BD está vacío o null, se devuelve una URL de imagen placeholder.

---

## Resumen

| Endpoint | Caché servidor | Cache-Control (navegador) | Rate limit | Auth |
|----------|----------------|---------------------------|------------|------|
| GET /api/landing | 5 min (solo sin query params) | public, max-age=60 | 60/min | No |
| GET /api/landing/barbers | 5 min (solo sin width/height/format) | public, max-age=60 | 60/min | No |

- **CORS:** Solo dominios en `CORS_ORIGIN` o `CORS_ORIGINS` pueden consumir la API (anti-leeching).
- **config.status:** `"open"` | `"closed"` según hora actual y horarios de barberos y excepciones.
- **Imágenes:** Parámetros opcionales `width`, `height`, `format` (webp/auto) para URLs Cloudinary; para S3/otros CDN, usar versiones optimizadas (WebP) en el CDN.

**Estabilidad y facilidad para el front:**

- El endpoint público **GET /api/landing** no crashea por fallos de caché: si el almacén de caché falla, se responde con datos frescos.
- **barbers[].photoUrl** y las URLs de **config** (hero, logo, about) nunca son null en la respuesta; si no hay imagen se usa un placeholder donde aplique.
- **galleryLimit** está acotado a máximo 100; **galleryOffset** a ≥ 0, para evitar respuestas desproporcionadas o parámetros inválidos.
