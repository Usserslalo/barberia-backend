# Panel de administración del Landing — API Admin

Documentación de los endpoints de administración del landing de **JC BARBER SHOP**. Solo usuarios con rol **ADMIN** pueden ejecutarlos.

Todas las rutas tienen el prefijo base **`/api/landing/admin`**. En todas las peticiones es obligatorio el header **`Authorization: Bearer <access_token>`** (JWT de un usuario con rol ADMIN). Respuestas **401** (no autenticado / token inválido) y **403** (rol distinto de ADMIN) aplican a cualquier endpoint.

---

## Índice de endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/landing/admin/config` | [ADMIN] Obtener configuración del landing |
| PATCH | `/api/landing/admin/config` | [ADMIN] Actualizar configuración del landing (PATCH parcial) |
| GET | `/api/landing/admin/barbers` | [ADMIN] Listar barberos (incluye inactivos) |
| POST | `/api/landing/admin/barbers` | [ADMIN] Crear barbero |
| GET | `/api/landing/admin/barbers/{id}` | [ADMIN] Obtener barbero por ID |
| PATCH | `/api/landing/admin/barbers/{id}` | [ADMIN] Actualizar barbero (PATCH parcial) |
| DELETE | `/api/landing/admin/barbers/{id}` | [ADMIN] Desactivar barbero (soft delete) |
| GET | `/api/landing/admin/services` | [ADMIN] Listar servicios (incluye inactivos) |
| POST | `/api/landing/admin/services` | [ADMIN] Crear servicio |
| GET | `/api/landing/admin/services/{id}` | [ADMIN] Obtener servicio por ID |
| PATCH | `/api/landing/admin/services/{id}` | [ADMIN] Actualizar servicio (PATCH parcial) |
| DELETE | `/api/landing/admin/services/{id}` | [ADMIN] Desactivar servicio (soft delete) |
| GET | `/api/landing/admin/gallery` | [ADMIN] Listar galería |
| POST | `/api/landing/admin/gallery` | [ADMIN] Añadir imagen a la galería |
| GET | `/api/landing/admin/gallery/{id}` | [ADMIN] Obtener elemento de galería por ID |
| DELETE | `/api/landing/admin/gallery/{id}` | [ADMIN] Eliminar imagen de la galería |
| GET | `/api/landing/admin/audit-logs` | [ADMIN] Listar audit logs del módulo landing-admin |

---

## Análisis de seguridad

| Aspecto | Estado | Detalle |
|--------|--------|---------|
| **Autenticación** | ✅ | Todos los endpoints exigen JWT (`JwtAuthGuard`). Sin token o token inválido → `401 Unauthorized`. |
| **Autorización (RBAC)** | ✅ | `RolesGuard` + `@Roles(ROLES.ADMIN)`. Usuario sin rol ADMIN → `403 Forbidden`. |
| **Validación de DTOs** | ✅ | `ValidationPipe` global con `whitelist: true` y `forbidNonWhitelisted: true`. Solo se aceptan propiedades definidas en los DTOs; el resto se rechaza con `400`. |
| **Imágenes (URLs)** | ✅ | Campos `photoUrl`, `imageUrl`, `heroBackgroundImage`, `logoUrl`, `aboutImageUrl`: `@IsUrl()` + `@IsAllowedImageUrl()` (solo dominios de `BASE_URL` / `ALLOWED_IMAGE_DOMAINS`). |
| **Soft delete** | ✅ | Barberos y Servicios: `DELETE` realiza desactivación (`isActive: false`), no borrado físico. Galería: eliminación real del registro y archivo propio si aplica. |
| **Invalidación de caché** | ✅ | Tras cada `POST`, `PATCH` o `DELETE` en config, barberos, servicios o galería se invalidan `landing:page` y `landing:barbers` para que el cliente final vea los cambios de inmediato. |

**Headers requeridos en todas las peticiones:**

- `Authorization: Bearer <access_token>` (JWT de un usuario con rol ADMIN).

---

## Configuración del landing

### GET `/api/landing/admin/config`

**[ADMIN] Obtener configuración del landing.**

| Campo | Valor |
|-------|--------|
| **Permisos** | JWT obligatorio + rol ADMIN. |
| **Request Body** | No aplica. |
| **Efectos secundarios** | Ninguno (solo lectura). |

**Respuesta 200:** Objeto con la configuración actual: `id`, `heroTitle`, `heroBackgroundImage`, `logoUrl`, `aboutTitle`, `aboutText`, `aboutImageUrl`, `phone`, `email`, `instagramUrl`, `whatsappUrl`, `whatsappPhoneId`, `whatsappWabaId`, `latitude`, `longitude`, `address`, `googleMapsIframe`, `updatedAt`.  
*Nota: El endpoint público GET /api/landing añade `status` y `navigationUrl`; GET admin/config devuelve solo los campos de la tabla (sin `status` ni `navigationUrl`).*

---

### PATCH `/api/landing/admin/config`

**[ADMIN] Actualizar configuración del landing (PATCH parcial).**

| Campo | Valor |
|-------|--------|
| **Permisos** | JWT obligatorio + rol ADMIN. |
| **Efectos secundarios** | Se invalidan las claves de caché: `landing:page`, `landing:barbers`. |

**Request Body (solo campos que se deseen cambiar):**

```json
{
  "heroTitle": "JC Barber Shop",
  "heroBackgroundImage": "https://tu-dominio.com/uploads/hero-bg.jpg",
  "logoUrl": "https://tu-dominio.com/uploads/logo.png",
  "aboutTitle": "Nuestra historia",
  "aboutText": "Texto de la sección Acerca de.",
  "aboutImageUrl": "https://tu-dominio.com/uploads/about.jpg",
  "phone": "+52 55 1234 5678",
  "email": "contacto@jcbarbershop.com",
  "instagramUrl": "https://www.instagram.com/jcbarbershop",
  "whatsappUrl": "https://wa.me/5215512345678",
  "whatsappPhoneId": "123456789012345",
  "whatsappWabaId": "987654321098765",
  "latitude": 19.4326,
  "longitude": -99.1332,
  "address": "Plaza Principal, Centro, CDMX",
  "googleMapsIframe": "https://www.google.com/maps?q=19.4326,-99.1332"
}
```

- Todas las propiedades son opcionales. Solo se actualizan las enviadas.
- URLs de imágenes deben ser válidas y pertenecer a `BASE_URL` o `ALLOWED_IMAGE_DOMAINS`.
- Si se reemplaza una imagen que apunta a `/uploads/`, el archivo anterior se elimina del servidor.

#### Campos inteligentes de ubicación

| Comportamiento | Detalle |
|----------------|---------|
| **Parser de Google Maps** | Si se envía `googleMapsIframe` con una **URL de Google Maps** o el **HTML completo de un iframe**, el backend intenta extraer automáticamente `latitude` y `longitude`. El admin no tiene que buscar coordenadas a mano. Se soportan patrones habituales: `?q=lat,lng`, `@lat,lng`, `query=lat,lng`, `ll=`, y el `src` del iframe. |
| **Dirección obligatoria al actualizar ubicación** | Si se envía **cualquiera** de `latitude`, `longitude` o `googleMapsIframe`, el campo **`address`** es obligatorio y debe tener al menos un carácter. Garantiza que el cliente final siempre tenga texto legible (ej. "Av. Juárez 123, Centro"). |
| **Validación de coordenadas** | `latitude` debe estar entre **-90 y 90**; `longitude` entre **-180 y 180**. Números inválidos o fuera de rango devuelven **400**. |
| **Enlace de navegación (público)** | El endpoint público **GET /api/landing** devuelve un campo calculado **`config.navigationUrl`** cuando hay lat/lng: `https://www.google.com/maps/search/?api=1&query={lat},{lng}`. El usuario puede abrir Google Maps o Waze desde el móvil con un solo clic. |

---

## Barberos

### GET `/api/landing/admin/barbers`

**[ADMIN] Listar barberos (incluye inactivos).**

| Campo | Valor |
|-------|--------|
| **Permisos** | JWT obligatorio + rol ADMIN. |
| **Query params** | `includeInactive` (opcional): `"true"` para incluir barberos con `isActive: false`. |
| **Efectos secundarios** | Ninguno. |

**Respuesta 200:** Array de barberos. Cada ítem incluye `isActive`; los inactivos se identifican por `isActive: false`. Si el barbero tiene cuenta de acceso, se incluye `userId`.

---

### GET `/api/landing/admin/barbers/:id`

**[ADMIN] Obtener barbero por ID.**

| Campo | Valor |
|-------|--------|
| **Permisos** | JWT obligatorio + rol ADMIN. |
| **Efectos secundarios** | Ninguno. |

**Respuesta 404:** Si no existe barbero con ese `id`.

---

### POST `/api/landing/admin/barbers`

**[ADMIN] Crear barbero.**

| Campo | Valor |
|-------|--------|
| **Permisos** | JWT obligatorio + rol ADMIN. |
| **Efectos secundarios** | Se invalidan: `landing:page`, `landing:barbers`. |

**Request Body:**

```json
{
  "name": "Juan Pérez",
  "roleDescription": "Barber Stylist",
  "photoUrl": "https://tu-dominio.com/uploads/barber.jpg",
  "experienceYears": 5,
  "bio": "Especialista en cortes clásicos.",
  "displayOrder": 0,
  "email": "juan@ejemplo.com",
  "phone": "+5215512345678",
  "password": "MiClave123"
}
```

- Obligatorios: `name`, `roleDescription`.
- Opcionales: `photoUrl`, `experienceYears`, `bio`, `displayOrder`.
- Para crear cuenta de acceso (rol BARBER): enviar juntos `email`, `phone` y `password` (phone en E.164; password mínimo 6 caracteres, al menos una letra y un número).
- `photoUrl` debe ser URL válida y de dominio permitido.

---

### PATCH `/api/landing/admin/barbers/:id`

**[ADMIN] Actualizar barbero (PATCH parcial).**

| Campo | Valor |
|-------|--------|
| **Permisos** | JWT obligatorio + rol ADMIN. |
| **Efectos secundarios** | Se invalidan: `landing:page`, `landing:barbers`. |

**Request Body (solo campos a cambiar):**

```json
{
  "name": "Juan Pérez García",
  "roleDescription": "Senior Barber",
  "photoUrl": "https://tu-dominio.com/uploads/barber-new.jpg",
  "experienceYears": 7,
  "bio": "Nueva biografía.",
  "displayOrder": 1,
  "isActive": true
}
```

- Todas las propiedades son opcionales. Solo se actualizan las enviadas.
- Cualquier propiedad no definida en el DTO será rechazada (`400`).

---

### DELETE `/api/landing/admin/barbers/:id`

**[ADMIN] Desactivar barbero (soft delete).**

| Campo | Valor |
|-------|--------|
| **Permisos** | JWT obligatorio + rol ADMIN. |
| **Comportamiento** | Se actualiza el barbero a `isActive: false`. No se borra la fila. |
| **Efectos secundarios** | Se invalidan: `landing:page`, `landing:barbers`. |

**Respuesta 200:** Barbero actualizado (con `isActive: false`).  
**Respuesta 404:** Barbero no encontrado.

---

## Servicios

### GET `/api/landing/admin/services`

**[ADMIN] Listar servicios (incluye inactivos).**

| Campo | Valor |
|-------|--------|
| **Permisos** | JWT obligatorio + rol ADMIN. |
| **Query params** | `includeInactive` (opcional): `"true"` para incluir servicios con `isActive: false`. |
| **Efectos secundarios** | Ninguno. |

**Respuesta 200:** Array de servicios. Los inactivos tienen `isActive: false`.

---

### GET `/api/landing/admin/services/:id`

**[ADMIN] Obtener servicio por ID.**

| Campo | Valor |
|-------|--------|
| **Permisos** | JWT obligatorio + rol ADMIN. |
| **Efectos secundarios** | Ninguno. |

**Respuesta 404:** Si no existe servicio con ese `id`.

---

### POST `/api/landing/admin/services`

**[ADMIN] Crear servicio.**

| Campo | Valor |
|-------|--------|
| **Permisos** | JWT obligatorio + rol ADMIN. |
| **Efectos secundarios** | Se invalidan: `landing:page`, `landing:barbers`. |

**Request Body:**

```json
{
  "name": "Corte de hombre",
  "description": "Corte clásico con tijera y máquina",
  "price": 280,
  "durationMinutes": 45,
  "category": "Corte",
  "categoryId": "uuid-categoria-opcional",
  "isActive": true
}
```

- Obligatorios: `name`, `price`, `durationMinutes`.
- Opcionales: `description`, `category`, `categoryId`, `isActive`. Si se envía `categoryId`, el campo `category` (string) se rellena con el nombre de la categoría.

---

### PATCH `/api/landing/admin/services/:id`

**[ADMIN] Actualizar servicio (PATCH parcial).**

| Campo | Valor |
|-------|--------|
| **Permisos** | JWT obligatorio + rol ADMIN. |
| **Efectos secundarios** | Se invalidan: `landing:page`, `landing:barbers`. |

**Request Body (solo campos a cambiar):**

```json
{
  "name": "Corte premium",
  "description": "Corte con acabado detallado",
  "price": 320,
  "durationMinutes": 50,
  "category": "Corte",
  "categoryId": "uuid-categoria",
  "isActive": true
}
```

- Todas las propiedades son opcionales. Si se envía `categoryId`, se actualiza también el `category` (string) desde la categoría.

---

### DELETE `/api/landing/admin/services/:id`

**[ADMIN] Desactivar servicio (soft delete).**

| Campo | Valor |
|-------|--------|
| **Permisos** | JWT obligatorio + rol ADMIN. |
| **Comportamiento** | Se actualiza el servicio a `isActive: false`. No se borra la fila. |
| **Efectos secundarios** | Se invalidan: `landing:page`, `landing:barbers`. |

**Respuesta 200:** Servicio actualizado (con `isActive: false`).  
**Respuesta 404:** Servicio no encontrado.

---

## Galería

### GET `/api/landing/admin/gallery`

**[ADMIN] Listar galería.**

| Campo | Valor |
|-------|--------|
| **Permisos** | JWT obligatorio + rol ADMIN. |
| **Efectos secundarios** | Ninguno. |

**Respuesta 200:** Array de elementos de galería (id, imageUrl, description, createdAt), ordenados por fecha de creación descendente.

---

### GET `/api/landing/admin/gallery/:id`

**[ADMIN] Obtener elemento de galería por ID.**

| Campo | Valor |
|-------|--------|
| **Permisos** | JWT obligatorio + rol ADMIN. |
| **Efectos secundarios** | Ninguno. |

**Respuesta 404:** Elemento no encontrado.

---

### POST `/api/landing/admin/gallery`

**[ADMIN] Añadir imagen a la galería.**

| Campo | Valor |
|-------|--------|
| **Permisos** | JWT obligatorio + rol ADMIN. |
| **Efectos secundarios** | Se invalidan: `landing:page`, `landing:barbers`. |

**Request Body:**

```json
{
  "imageUrl": "https://tu-dominio.com/uploads/work-1.jpg",
  "description": "Corte + modelado de barba"
}
```

- `imageUrl` obligatorio; debe ser URL válida y de dominio permitido.
- `description` opcional (máx. 300 caracteres).

---

### DELETE `/api/landing/admin/gallery/:id`

**[ADMIN] Eliminar imagen de la galería.**

| Campo | Valor |
|-------|--------|
| **Permisos** | JWT obligatorio + rol ADMIN. |
| **Comportamiento** | Eliminación real del registro. Si `imageUrl` apunta a `/uploads/`, se borra también el archivo del servidor. |
| **Efectos secundarios** | Se invalidan: `landing:page`, `landing:barbers`. |

**Respuesta 204:** Sin contenido (no hay body en la respuesta).  
**Respuesta 404:** Elemento no encontrado.

---

## Resumen de claves de caché invalidadas

Tras cualquier **POST**, **PATCH** o **DELETE** en:

- Config: `PATCH /api/landing/admin/config`
- Barberos: `POST`, `PATCH`, `DELETE /api/landing/admin/barbers[/:id]`
- Servicios: `POST`, `PATCH`, `DELETE /api/landing/admin/services[/:id]`
- Galería: `POST`, `DELETE /api/landing/admin/gallery[/:id]`

se invalidan de forma inmediata las claves:

- `landing:page` — usada por el endpoint público de la landing completa.
- `landing:barbers` — usada por el endpoint público de listado de barberos.

Así el cliente final ve los cambios sin esperar al TTL del caché.

---

## Sistema de Auditoría

Todas las acciones **POST**, **PATCH** y **DELETE** del panel landing-admin se registran automáticamente en un **Audit Log**. Así se mantiene trazabilidad de quién hizo qué, cuándo y qué cambió.

### Acciones que se registran

| Acción (action)      | Entidad (entity) | Descripción                                      |
|----------------------|------------------|--------------------------------------------------|
| `UPDATE_CONFIG`      | LandingConfig    | PATCH configuración del landing                  |
| `CREATE_BARBER`      | Barber           | POST crear barbero                               |
| `UPDATE_BARBER`      | Barber           | PATCH actualizar barbero                         |
| `DELETE_BARBER`      | Barber           | DELETE desactivar barbero (soft delete)          |
| `CREATE_SERVICE`     | Service          | POST crear servicio                              |
| `UPDATE_SERVICE`     | Service          | PATCH actualizar servicio                        |
| `DELETE_SERVICE`     | Service          | DELETE desactivar servicio (soft delete)         |
| `CREATE_GALLERY_ITEM`| GalleryItem      | POST añadir imagen a la galería                  |
| `DELETE_GALLERY_ITEM`| GalleryItem      | DELETE eliminar imagen de la galería             |

Cada registro incluye:

- **adminId**: ID del usuario (ADMIN) que ejecutó la acción.
- **action** y **entity**: tipo de operación y entidad afectada.
- **entityId**: ID del recurso (barbero, servicio, ítem de galería o config).
- **oldData**: estado anterior (JSON). En POST es `null`; en PATCH/DELETE es el estado previo.
- **newData**: estado nuevo o creado (JSON). En DELETE de galería puede ser `{ "deleted": true }`.
- **createdAt**: fecha y hora de la acción.

El guardado del log es **asíncrono** (fire-and-forget) para no retrasar la respuesta al usuario.

### GET `/api/landing/admin/audit-logs`

**[ADMIN] Listar audit logs del módulo landing-admin.** Historial de quién hizo qué, cuándo y qué cambió. Incluye paginación y filtros.

| Campo | Valor |
|-------|--------|
| **Permisos** | JWT obligatorio + rol ADMIN. |
| **Query params** | `page`, `limit`, `entity`, `adminId` (todos opcionales). |
| **Efectos secundarios** | Ninguno (solo lectura). |

| Query param | Tipo   | Descripción                                                                 |
|-------------|--------|-----------------------------------------------------------------------------|
| `page`      | number | Página (1-based). Por defecto: 1.                                            |
| `limit`     | number | Tamaño de página (1-100). Por defecto: 20.                                  |
| `entity`    | string | Filtrar por entidad: `LandingConfig`, `Barber`, `Service`, `GalleryItem`.  |
| `adminId`   | string | Filtrar por ID del usuario (admin) que realizó la acción.                 |

**Respuesta 200:** Objeto con:

- **items**: array de registros de auditoría (cada uno con `id`, `adminId`, `action`, `entity`, `entityId`, `oldData`, `newData`, `createdAt` y relación **admin** con `id`, `email`, `firstName`, `lastName`).
- **total**: número total de registros que cumplen el filtro (para paginación en el front).

**Ejemplo:**

```http
GET /api/landing/admin/audit-logs?page=1&limit=10&entity=Barber
Authorization: Bearer <access_token>
```

```json
{
  "items": [
    {
      "id": "uuid",
      "adminId": "uuid-admin",
      "action": "UPDATE_BARBER",
      "entity": "Barber",
      "entityId": "uuid-barber",
      "oldData": { "name": "Juan", "isActive": true, ... },
      "newData": { "name": "Juan Pérez", "isActive": true, ... },
      "createdAt": "2026-02-04T14:00:00.000Z",
      "admin": {
        "id": "uuid-admin",
        "email": "admin@jcbarbershop.com",
        "firstName": "Admin",
        "lastName": null
      }
    }
  ],
  "total": 42
}
```
