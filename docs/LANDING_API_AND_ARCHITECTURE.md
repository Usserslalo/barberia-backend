# Módulo Landing — Documentación y Arquitectura

**Versión:** 1.0  
**Última actualización:** Febrero 2026  
**Alcance:** APIs públicas del Landing, panel Admin, subida de imágenes, auditoría y análisis técnico.

---

## 1. Descripción general

El módulo **Landing** expone:

- **APIs públicas**: datos del sitio (hero, about, barberos, servicios, galería) para el frontend del landing y del flujo de reserva.
- **APIs de administración** (`/api/landing/admin/*`): CRUD de configuración, barberos, servicios y galería, solo para rol **ADMIN**.
- **Subida de imágenes** (`/api/upload/image`): multipart para hero, logo, about, barberos y galería (solo ADMIN).
- **Auditoría**: historial de acciones del panel admin (quién, qué, cuándo, old/new data).

**Stack relevante:** NestJS, Prisma, PostgreSQL, JWT (guard global), rate limiting (Throttler), caché en memoria (landing/barbers).

---

## 2. Separación Público vs Admin

| Aspecto | Público | Admin |
|--------|---------|--------|
| **Prefijo** | `/api/landing` | `/api/landing/admin` |
| **Autenticación** | No (endpoints con `@Public()`) | JWT obligatorio |
| **Autorización** | — | Solo rol `ADMIN` |
| **Rate limit** | 60 req/min (Throttle en controlador) | 100 req/min (global) |
| **Cache-Control** | `public, max-age=60` en respuestas GET | Sin cabecera de caché |
| **Auditoría** | No | Sí (AuditInterceptor en POST/PATCH/DELETE) |

---

## 3. Tabla de endpoints

### 3.1 Landing público

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/landing` | Datos completos: config (con `status` open/closed), barbers, services, gallery |
| `GET` | `/api/landing/barbers` | Barberos activos (mismo dato que sección "Nuestro equipo") |

**Query params opcionales (GET /api/landing):**

- `galleryLimit` (1–100), `galleryOffset` (≥ 0): paginación de galería.
- `width`, `height`, `format` (webp \| auto): transformación de URLs de imágenes (Cloudinary).

**Query params opcionales (GET /api/landing/barbers):**

- `width`, `height`, `format`: idem para `photoUrl`.

---

### 3.2 Landing Admin (requieren `Authorization: Bearer <access_token>` y rol ADMIN)

#### Configuración

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/landing/admin/config` | Obtener configuración del landing |
| `PATCH` | `/api/landing/admin/config` | Actualizar configuración (parcial) |

#### Barberos

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/landing/admin/barbers` | Listar barberos (query `includeInactive=true` para inactivos) |
| `GET` | `/api/landing/admin/barbers/:id` | Obtener barbero por ID |
| `POST` | `/api/landing/admin/barbers` | Crear barbero (opcional: cuenta con email/password/phone) |
| `PATCH` | `/api/landing/admin/barbers/:id` | Actualizar barbero (parcial) |
| `DELETE` | `/api/landing/admin/barbers/:id` | Desactivar barbero (soft delete: `isActive = false`) |

#### Servicios

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/landing/admin/services` | Listar servicios (query `includeInactive=true` para inactivos) |
| `GET` | `/api/landing/admin/services/:id` | Obtener servicio por ID |
| `POST` | `/api/landing/admin/services` | Crear servicio |
| `PATCH` | `/api/landing/admin/services/:id` | Actualizar servicio (parcial) |
| `DELETE` | `/api/landing/admin/services/:id` | Desactivar servicio (soft delete: `isActive = false`) |

#### Galería

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/landing/admin/gallery` | Listar ítems de galería |
| `GET` | `/api/landing/admin/gallery/:id` | Obtener ítem por ID |
| `POST` | `/api/landing/admin/gallery` | Añadir imagen a la galería |
| `DELETE` | `/api/landing/admin/gallery/:id` | Eliminar ítem (hard delete en BD y archivo local si aplica) |

#### Auditoría

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/landing/admin/audit-logs` | Listar audit logs (paginación: `page`, `limit`; filtros: `entity`, `adminId`) |

---

### 3.3 Upload (requieren JWT + ADMIN)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/upload/image` | Subir imagen (multipart `file`). Devuelve `url` y `filename`. |

---

## 4. Ejemplos de request/response

### 4.1 GET /api/landing (público)

**Request:**

```http
GET /api/landing?galleryLimit=10&format=webp
```

**Response 200 (resumido):**

```json
{
  "config": {
    "id": "11111111-1111-1111-1111-111111111111",
    "status": "open",
    "heroTitle": "Bober Barbershop",
    "heroBackgroundImage": "https://...",
    "logoUrl": "https://...",
    "aboutTitle": "O NAC",
    "aboutText": "...",
    "aboutImageUrl": "https://...",
    "phone": "+52 55 1234 5678",
    "email": "contacto@boberbarbershop.com",
    "instagramUrl": "https://...",
    "whatsappUrl": "https://...",
    "latitude": 19.4326,
    "longitude": -99.1332,
    "address": "Plaza de la Constitución...",
    "navigationUrl": "https://www.google.com/maps/search/?api=1&query=19.4326,-99.1332",
    "updatedAt": "2026-02-01T12:00:00.000Z"
  },
  "barbers": [
    {
      "id": "uuid",
      "name": "Sergey Trifonov",
      "roleDescription": "Barber Stylist",
      "bio": "...",
      "photoUrl": "https://...",
      "experienceYears": 5,
      "displayOrder": 0,
      "isActive": true
    }
  ],
  "services": [
    {
      "id": "uuid",
      "name": "Corte de hombre",
      "description": "...",
      "price": 250,
      "durationMinutes": 45,
      "category": "Corte",
      "categoryId": "uuid",
      "isActive": true
    }
  ],
  "gallery": [
    {
      "id": "uuid",
      "imageUrl": "https://...",
      "description": "Corte + barba",
      "createdAt": "2026-02-01T10:00:00.000Z"
    }
  ]
}
```

---

### 4.2 PATCH /api/landing/admin/config (Admin)

**Request:**

```http
PATCH /api/landing/admin/config
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "heroTitle": "Bober Barbershop",
  "phone": "+52 55 9999 8888"
}
```

**Response 200:** objeto completo de `LandingConfig` (sin `status`; el público sí lo incluye).

---

### 4.3 POST /api/landing/admin/barbers (Admin)

**Request:**

```http
POST /api/landing/admin/barbers
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "Sergey Trifonov",
  "roleDescription": "Barber Stylist",
  "photoUrl": "http://localhost:3000/uploads/abc-123.jpg",
  "experienceYears": 5,
  "bio": "Especialista en cortes clásicos.",
  "displayOrder": 0
}
```

**Response 201:** objeto barbero creado (incluye `userId` si se creó cuenta con `email`, `password`, `phone`).

---

### 4.4 DELETE /api/landing/admin/barbers/:id (Admin) — Soft delete

**Request:**

```http
DELETE /api/landing/admin/barbers/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <access_token>
```

**Response 200:** objeto barbero actualizado (`isActive: false`).

---

### 4.5 POST /api/upload/image (Admin)

**Request:**

```http
POST /api/upload/image
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

file: <binary>
```

**Response 201:**

```json
{
  "url": "http://localhost:3000/uploads/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg",
  "filename": "a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg"
}
```

---

### 4.6 GET /api/landing/admin/audit-logs (Admin)

**Request:**

```http
GET /api/landing/admin/audit-logs?page=1&limit=20&entity=Barber
Authorization: Bearer <access_token>
```

**Response 200:**

```json
{
  "items": [
    {
      "id": "uuid",
      "adminId": "uuid",
      "action": "UPDATE_BARBER",
      "entity": "Barber",
      "entityId": "uuid-barber",
      "oldData": { "name": "Antes", "isActive": true },
      "newData": { "name": "Después", "isActive": false },
      "createdAt": "2026-02-01T14:00:00.000Z",
      "admin": {
        "id": "uuid",
        "email": "admin@example.com",
        "firstName": "Admin",
        "lastName": "User"
      }
    }
  ],
  "total": 42
}
```

---

## 5. Códigos de error esperados

### 5.1 Estructura estándar de error (existente)

El filtro global (`HttpExceptionFilter`) devuelve:

```json
{
  "statusCode": 400,
  "timestamp": "2026-02-06T12:00:00.000Z",
  "path": "/api/landing/admin/barbers",
  "message": "El nombre es obligatorio",
  "code": "VALIDATION_ERROR"
}
```

- **Campos:** `statusCode`, `timestamp`, `path`, `message` (string o array en validación).
- **Opcional:** `code` (ej. `THROTTLED` para 429).
- **Solo no producción:** `errorResponse` con el objeto original de la excepción.

### 5.2 Errores por endpoint (resumen)

| Código HTTP | Situación típica |
|-------------|------------------|
| **400** | Body inválido (validación DTO), archivo no permitido o ausente en upload |
| **401** | Sin token o token inválido/expirado |
| **403** | Rol distinto de ADMIN (o sin usuario en request) |
| **404** | Config no encontrada (GET /api/landing), barbero/servicio/galería por ID no encontrado |
| **409** | Email ya registrado al crear barbero con cuenta |
| **429** | Rate limit superado (p. ej. 60/min en landing público) |
| **500** | Error interno (mensaje genérico en producción) |

---

## 6. Reglas de autorización

- **Público:** solo `GET /api/landing` y `GET /api/landing/barbers`; no requieren JWT (decorador `@Public()`).
- **Admin:** todas las rutas bajo `/api/landing/admin/*` requieren:
  - JWT válido (guard global `JwtAuthGuard`).
  - Rol `ADMIN` (`RolesGuard` con `@Roles(ROLES.ADMIN)`).
- **Upload:** `/api/upload/image` requiere JWT + rol `ADMIN` (mismo criterio que admin).
- No hay autorización por recurso (multi-tenant): un ADMIN puede ver/editar toda la configuración y entidades del landing.

---

## 7. Convenciones usadas

- **Prefijo global:** todas las rutas bajo `/api`.
- **PATCH parcial:** en config, barberos y servicios solo se envían los campos a cambiar; el backend usa `omitUndefined` y no pisa el resto.
- **Soft delete en barberos y servicios:** `DELETE` hace `isActive = false`; no se borra el registro. La galería usa **hard delete** (registro + archivo propio si aplica).
- **IDs:** UUID v4 en todas las entidades.
- **Validación:** `ValidationPipe` global con `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.
- **Imágenes en DTOs:** URLs validadas con `@IsUrl()` y `@IsAllowedImageUrl()` (solo dominios permitidos: `BASE_URL`, `ALLOWED_IMAGE_DOMAINS`).
- **Auditoría:** solo POST/PATCH/DELETE del landing-admin; se guarda `oldData`/`newData` de forma asíncrona (fire-and-forget).

---

## 8. Análisis del diseño de las APIs

### 8.1 Lo que está bien

- **Naming:** Rutas REST claras: `/landing`, `/landing/barbers`, `/landing/admin/config`, `/landing/admin/barbers`, etc.
- **Verbos HTTP:** GET para lectura, POST para creación, PATCH para actualización parcial, DELETE para desactivar o eliminar. Coherente con semántica REST.
- **PATCH vs PUT:** Uso correcto de PATCH para actualizaciones parciales; no se exige cuerpo completo.
- **Soft delete en barberos/servicios:** Consistente con reglas de negocio (no borrar datos históricos); el público solo ve `isActive: true`.
- **Separación público/admin:** Misma base de datos, distintos contratos y permisos; cache y rate limit diferenciados.
- **Códigos HTTP:** 200/201/204 según acción; 404 para no encontrado; 400 para validación.

### 8.2 Problemas e inconsistencias detectados

1. **DELETE barber/servicio devuelve 200 + body; DELETE gallery devuelve 204 sin body**  
   - Inconsistencia para el cliente. Recomendación: unificar criterio (p. ej. 200 + body para soft delete y 204 para hard delete, o documentar explícitamente la diferencia).

2. **Ruta de upload fuera del módulo landing**  
   - `/api/upload/image` es genérico y usado por landing; conceptualmente podría vivir bajo `/api/landing/admin/upload/image` si se quiere que todo lo “admin landing” esté agrupado. No es obligatorio si se considera “upload” un recurso global.

3. **GET /api/landing/admin/barbers y /services sin paginación**  
   - Con muchos barberos/servicios la respuesta puede ser grande. Recomendación: añadir paginación (`page`, `limit`) o al menos `limit` máximo (ej. 100).

4. **Falta endpoint para reactivar barbero/servicio**  
   - Hoy para “reactivar” hay que usar PATCH con `isActive: true`. No es un error, pero un `PATCH .../barbers/:id/activate` (o documento explícito) puede mejorar la UX del panel.

5. **Orden de galería**  
   - La galería se ordena por `createdAt` desc; no hay campo `displayOrder`. Si el negocio necesita orden editable, haría falta añadir `displayOrder` y PATCH para reordenar.

### 8.3 Posibles endpoints faltantes

- **Paginación en listados admin:** `GET /api/landing/admin/barbers` y `GET /api/landing/admin/services` con `page` y `limit`.
- **Reordenación de galería:** PATCH que acepte `displayOrder` o endpoint tipo `PATCH /api/landing/admin/gallery/reorder` con array de `{ id, order }`.
- **Health/readiness:** Fuera del módulo landing, pero útil en producción; no bloquea el diseño del landing.

---

## 9. Manejo de errores — Recomendaciones

### 9.1 Estructura estándar propuesta (evolución del actual)

Mantener la actual y extender con un `code` estable para el front:

```json
{
  "statusCode": 400,
  "timestamp": "2026-02-06T12:00:00.000Z",
  "path": "/api/landing/admin/barbers",
  "message": "El nombre es obligatorio",
  "code": "VALIDATION_ERROR",
  "details": [
    { "field": "name", "constraints": ["minLength"] }
  ]
}
```

- **Públicos (seguros para cliente):** 400 (validación), 404 (recurso no encontrado), 409 (conflict), 429 (rate limit). Mensaje claro, sin datos internos.
- **No exponer en producción:** stack traces, rutas internas, `errorResponse` (ya se oculta con `NODE_ENV === 'production'`).
- **Validación:** seguir usando class-validator; mensajes en español y, si se quiere, un `code` por tipo (e.g. `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `THROTTLED`) para que el front reaccione por código.

### 9.2 Errores comunes por zona

- **Landing público:** 404 (config no encontrada), 429 (throttle).
- **Admin (config/barbers/services/gallery):** 400 (DTO), 401 (no auth), 403 (no ADMIN), 404 (id no encontrado), 409 (email duplicado en create barber).
- **Upload:** 400 (sin file, tipo/tamaño no permitido), 401/403 igual que admin.

---

## 10. Subida y manejo de imágenes

### 10.1 Estado actual

- **Almacenamiento:** disco local en `uploads/`; servido como estático en `/uploads/`.
- **Endpoint:** `POST /api/upload/image` (multipart `file`); solo ADMIN; límite 5 MB; MIME: jpeg, jpg, png, webp.
- **Nombres de archivo:** `randomUUID()` + extensión según `originalname` (o `.jpg` por defecto) — evita colisiones y nombres predecibles.
- **Uso en landing:** config (hero, logo, about), barberos (photoUrl), galería (imageUrl). Las URLs se guardan en BD; si son propias (`/uploads/`), al reemplazar o eliminar entidad se borra el archivo en disco.
- **Validación de URLs en DTOs:** `IsAllowedImageUrl`: solo dominios de `BASE_URL` y `ALLOWED_IMAGE_DOMAINS` (evita SSRF/links externos en imágenes).

### 10.2 Recomendaciones

| Tema | Recomendación |
|------|----------------|
| **Estrategia de almacenamiento** | Para producción escalable y alta disponibilidad: usar **S3** (o compatible) o **Cloudinary**. Local está bien para desarrollo o instancia única; en múltiples instancias o serverless, un store externo evita problemas de persistencia y duplicados. |
| **Validación** | Mantener validación por MIME y extensión; opcionalmente validar magic bytes (evita falsificación de extensión). Límite 5 MB es razonable; documentarlo en la API. |
| **Nombres de archivo** | Mantener UUID + extensión; no usar `originalname` sin sanitizar (riesgo path traversal y caracteres problemáticos). |
| **Eliminación segura** | Solo borrar archivos que pertenezcan al servidor (`isOwnUploadUrl`); no borrar URLs externas. Comportamiento actual es correcto. |
| **Relación imagen–entidad** | Hoy la relación es por URL en campo string. Si se migra a S3/Cloudinary, se puede seguir guardando URL final; opcionalmente guardar `key`/`publicId` para borrado en cloud. |
| **Al eliminar entidades** | Barbero/servicio: soft delete no borra la foto (correcto). Config: al cambiar hero/logo/about se borra el archivo anterior si era propio. Galería: hard delete + borrado de archivo propio. Recomendación: no borrar físicamente en “soft delete” para poder restaurar; solo en hard delete (galería) o al reemplazar URL. |

### 10.3 Resumen

- Estrategia actual es válida para desarrollo y single-node.
- Para producción a largo plazo: migrar a S3 o Cloudinary; mantener validaciones (tipo, tamaño, nombres) y política de borrado solo para archivos propios y solo cuando la entidad se elimina o la URL se reemplaza.

---

## 11. Seguridad

### 11.1 Protección por roles

- **Guard global:** `JwtAuthGuard` aplicado a todas las rutas; solo las marcadas con `@Public()` no exigen JWT.
- **Admin:** `RolesGuard` + `@Roles(ROLES.ADMIN)` en el controlador de landing-admin y en upload. Correcto.
- **Recomendación:** mantener un único rol ADMIN para este panel; si en el futuro hubiera más roles (ej. EDITOR_LANDING), definir permisos por recurso y documentarlos.

### 11.2 Validación de inputs

- ValidationPipe global con whitelist y forbidNonWhitelisted.
- DTOs con class-validator; longitudes máximas, formatos (email, URL, E.164 para teléfono).
- URLs de imagen restringidas a dominios permitidos (`IsAllowedImageUrl`). Bien.

### 11.3 Prevención de IDOR

- No hay multi-tenant: un ADMIN puede acceder a cualquier barbero/servicio/galería por ID. No hay IDOR entre “tenants”.
- Los IDs son UUID; no hay enumeración secuencial. Aún así, validar siempre que el recurso exista (el servicio lanza 404 si no); comportamiento actual es correcto.

### 11.4 Auditoría

- **Qué se registra:** acción (CREATE/UPDATE/DELETE por entidad), entidad, entityId, oldData, newData, adminId, createdAt.
- **Cuándo:** en POST/PATCH/DELETE del landing-admin (AuditInterceptor); el log es asíncrono para no retrasar la respuesta.
- **Recomendación:** no registrar campos sensibles en `oldData`/`newData` (p. ej. si en el futuro se guardara hash de contraseña en algún DTO, excluirlo). Hoy no aplica; solo config, barberos, servicios y galería.

### 11.5 Rate limiting

- Landing público: 60 req/min por ruta (Throttler en controlador).
- Resto: límite global (100 req/min por defecto).
- El filtro devuelve 429 y opcionalmente `code: 'THROTTLED'`. Ajustar TTL/límites según tráfico real; considerar límites más estrictos en login si se añaden más endpoints de auth.

### 11.6 Cacheabilidad

- **Cacheables (GET públicos):** `GET /api/landing` y `GET /api/landing/barbers` con `Cache-Control: public, max-age=60`. Correcto.
- **No cachear:** todo lo que requiera JWT (admin, upload) y respuestas que dependan del usuario. No enviar `Cache-Control` en admin; comportamiento actual es adecuado.
- Caché en servidor (memoria) para landing completo y barbers cuando no hay query de transformación de imagen; se invalida al mutar config/barbers/services/gallery. Bien.

---

## 12. Análisis del schema.prisma (Landing y entidades relacionadas)

### 12.1 Modelos relevantes

- **LandingConfig:** una sola fila (id fijo en constantes); hero, about, contacto, mapa (lat/lng, address, googleMapsIframe), WhatsApp Meta IDs.
- **Barber:** nombre, roleDescription, bio, photoUrl, experienceYears, displayOrder, isActive; relación opcional 1:1 con User (cuenta de acceso).
- **Service:** name, description, price, durationMinutes, category (legacy), categoryId (FK a ServiceCategory), isActive.
- **GalleryItem:** imageUrl, description, createdAt.
- **AuditLog:** adminId, action, entity, entityId, oldData, newData, createdAt; índices en adminId, entity, createdAt.

### 12.2 Evaluación y mejoras sugeridas

| Aspecto | Estado | Recomendación |
|--------|--------|----------------|
| **Relaciones** | Correctas: Barber–User opcional, Service–ServiceCategory opcional. | Sin cambio. |
| **Soft delete** | Barber y Service usan `isActive`; no hay `deletedAt`. | Opcional: añadir `deletedAt` (DateTime?) para auditoría y restauración; consultas filtrar por `deletedAt: null` o `isActive: true` según necesidad. |
| **LandingConfig** | Sin `createdAt`. | Opcional: añadir `createdAt` para trazabilidad; no crítico si solo hay una fila. |
| **GalleryItem** | Sin soft delete; sin `displayOrder`. | Si el negocio pide orden editable: añadir `displayOrder Int @default(0)` y usarlo en ordenación. |
| **AuditLog** | Índices en adminId, entity, createdAt. | Adecuado para listados filtrados y por fecha. Considerar retención (política o job que archive/borre logs muy antiguos). |
| **Naming** | Consistente en inglés; camelCase. | Mantener. |
| **Enums** | No usados en modelos de landing; Role y AppointmentStatus en otros módulos. | Sin cambio. |

### 12.3 Índices recomendados

- **Barber:** ya se consulta por `isActive` y `displayOrder`; considerar `@@index([isActive, displayOrder])` para GET públicos y admin.
- **Service:** `@@index([isActive])` o `@@index([isActive, category])` si las listas crecen.
- **GalleryItem:** sin FK; si se añade `displayOrder`, `@@index([displayOrder])` o ordenar por él sin índice si la tabla es pequeña.

### 12.4 Campos de auditoría

- **LandingConfig:** solo `updatedAt`; sin `createdAt`. Aceptable para singleton.
- **Barber, Service:** no tienen `createdAt`/`updatedAt` en el schema actual; conviene añadirlos para auditoría y soporte (“cuándo se creó/modificó este barbero”). **Recomendación:** añadir `createdAt` y `updatedAt` a Barber y Service.
- **GalleryItem:** tiene `createdAt`; opcional `updatedAt` si se permite editar descripción.
- **AuditLog:** solo `createdAt`; suficiente para “cuándo”.

---

## 13. Resumen ejecutivo

- **APIs:** Bien estructuradas; separación público/admin clara; PATCH parcial y soft delete en barberos/servicios bien aplicados. Pequeñas mejoras: unificar respuesta de DELETE (200+body vs 204), paginación en listados admin, opcional reordenación de galería.
- **Errores:** Estructura actual es sólida; se puede enriquecer con `code` y `details` para el front; mantener mensajes seguros en producción.
- **Imágenes:** Correcto para desarrollo; en producción planear S3/Cloudinary; validaciones y borrado solo de archivos propios están bien.
- **Seguridad:** JWT + rol ADMIN; validación y dominios permitidos para URLs; auditoría en mutaciones; rate limit en público. Adecuado para el contexto.
- **Schema:** Añadir `createdAt`/`updatedAt` a Barber y Service; opcional `deletedAt` y `displayOrder` en GalleryItem según necesidades de producto; índices según volumen de datos.

Este documento sirve como referencia única para integración frontend, mantenimiento y evolución del módulo Landing en producción.
