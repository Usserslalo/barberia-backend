# Guía de integración Front-end — Sistema de Citas (Caballeros Barber Shop)

Documento técnico alineado **exactamente** con el backend. Base URL: `{BASE_URL}/api` (ej. `http://localhost:3000/api`). Prefijo global de la API: `api` (ver `main.ts`). Todas las rutas de citas están bajo **`/api/appointments/`**.

---

## 1. Schema y modelos (Prisma)

### 1.1 Enum `AppointmentStatus`

Definido en `prisma/schema.prisma`:

| Valor      | Descripción en backend |
|-----------|-------------------------|
| `PENDING` | Cita creada; esperando aceptación del barbero. |
| `ACCEPTED`| Aceptada por el barbero. |
| `REJECTED`| Rechazada (obligatorio `rejectionReason` en PATCH). |
| `CANCELLED` | Cancelada. |
| `COMPLETED` | Realizada (puntos de lealtad al pasar ACCEPTED→COMPLETED). |

Transiciones permitidas (lógica en `updateAppointmentStatus`):

- `PENDING` → `ACCEPTED` | `REJECTED` | `CANCELLED`
- `ACCEPTED` → `COMPLETED` | `CANCELLED`
- `REJECTED` | `CANCELLED` | `COMPLETED` → ninguna (estados finales).

### 1.2 Campo `rejectionReason`

- **Modelo:** `Appointment.rejectionReason` (String?, opcional en BD).
- **Obligatorio en API:** Solo en `PATCH /appointments/:id/status` cuando `status` es `REJECTED`. Validado en servicio: si `status === 'REJECTED'` y `(dto.rejectionReason ?? '').trim()` está vacío → **400** con mensaje `"rejectionReason es obligatorio cuando el estado es REJECTED"`.
- **Longitud:** max 500 caracteres (`UpdateAppointmentStatusDto` con `@MaxLength(500)`).
- **En respuestas:** El modelo Prisma incluye `rejectionReason`; en GET puede ser `null`.

### 1.3 Entidad `SlotLock`

- **Qué es:** Bloqueo temporal de un slot (barbero + `slotStart` DateTime) por **5 minutos** (`SLOT_LOCK_MINUTES` en servicio).
- **Uso:** El usuario selecciona un horario → front llama `POST /appointments/slot-lock` → backend crea/actualiza lock con `expiresAt = now + 5 min`. Si otro usuario tiene el lock activo → **409** con `code: 'TEMPORARILY_LOCKED'`. Al confirmar con `POST /appointments` el backend elimina el lock de ese usuario.
- El front no persiste `SlotLock`; solo consume el endpoint.

---

## 2. Endpoints de citas (rutas exactas y contrato)

Todas las rutas son relativas a `{BASE_URL}/api/appointments/`. Donde se indica **JWT** es obligatorio el header `Authorization: Bearer <access_token>`.

---

### 2.1 GET `/api/appointments/my`

- **Controlador:** `getMyAppointments`, `@Get('my')`, `@UseGuards(JwtAuthGuard)`.
- **Auth:** JWT obligatorio.
- **Query:** `date` (opcional). Formato `YYYY-MM-DD`. Si se envía, el backend filtra citas cuyo `date` cae en ese día (intervalo `[date 00:00:00, date+1d)` en hora local del servidor).
- **Respuesta 200:** Array de objetos con:
  - Campos del modelo **Appointment:** `id`, `date`, `status`, `notes`, `rejectionReason`, `reminderSent`, `loyaltyPointsAwarded`, `userId`, `barberId`, `serviceId`, `createdAt`, `updatedAt`.
  - **barber:** objeto completo Barber: `id`, `name`, `roleDescription`, `bio`, `photoUrl`, `experienceYears`, `displayOrder`, `isActive`.
  - **service:** objeto completo Service: `id`, `name`, `description`, `price`, `durationMinutes`, `category`, `categoryId`, `isActive`.
  - **totalEstimatedMinutes:** número (igual a `service.durationMinutes`).
  - **servicePrice:** número (igual a `service.price`).
- **Orden:** `date` descendente.
- **Errores:** 401 si no autenticado.

Ejemplo de ítem de respuesta (campos reales):

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "date": "2026-02-15T09:00:00.000Z",
  "status": "ACCEPTED",
  "notes": "Corte bajo",
  "rejectionReason": null,
  "reminderSent": false,
  "loyaltyPointsAwarded": false,
  "userId": "770e8400-e29b-41d4-a716-446655440002",
  "barberId": "33333333-3333-3333-3333-333333333301",
  "serviceId": "22222222-2222-2222-2222-222222222201",
  "createdAt": "2026-02-15T08:58:00.000Z",
  "updatedAt": "2026-02-15T09:10:00.000Z",
  "totalEstimatedMinutes": 30,
  "servicePrice": 15.5,
  "barber": {
    "id": "33333333-3333-3333-3333-333333333301",
    "name": "Carlos",
    "roleDescription": "Top Barber",
    "bio": "...",
    "photoUrl": "https://...",
    "experienceYears": 5,
    "displayOrder": 0,
    "isActive": true
  },
  "service": {
    "id": "22222222-2222-2222-2222-222222222201",
    "name": "Corte Clásico",
    "description": null,
    "price": 15.5,
    "durationMinutes": 30,
    "category": "General",
    "categoryId": "...",
    "isActive": true
  }
}
```

---

### 2.2 GET `/api/appointments/barber`

- **Controlador:** `getBarberAppointments`, `@Get('barber')`, `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles(ROLES.BARBER)`.
- **Auth:** JWT + rol **BARBER**.
- **Lógica previa:** Si `!user.barberId` el controlador lanza **403** con mensaje exacto: `"Usuario barbero sin perfil de barbero asignado"`. No se llama al servicio.
- **Query:** `date` (opcional). Formato `YYYY-MM-DD`. Mismo criterio de filtro por día que en GET my.
- **Respuesta 200:** Array de objetos con:
  - Campos del modelo **Appointment:** `id`, `date`, `status`, `notes`, `rejectionReason`, `reminderSent`, `loyaltyPointsAwarded`, `userId`, `barberId`, `serviceId`, `createdAt`, `updatedAt`.
  - **user:** `{ "id", "firstName", "lastName", "email", "phone" }` (solo esos campos).
  - **service:** objeto completo Service (mismos campos que en GET my).
- **Orden:** `date` descendente.
- **Errores:** 401 no autenticado, 403 si no es BARBER o si no tiene `barberId`.

---

### 2.3 GET `/api/appointments/available-slots`

- **Controlador:** `getAvailableSlots`, `@Get('available-slots')`, `@Public()` (sin JWT), `@UsePipes(new ValidationPipe({ transform: true }))`.
- **Auth:** Ninguna.
- **Query (todos obligatorios):**
  - `barberId`: string, UUID (regex en `AvailableSlotsQueryDto`: `^[0-9a-f]{8}-...$`). Mensajes de validación: `"barberId es obligatorio"`, `"barberId debe ser un UUID válido"`.
  - `date`: string, formato fecha (IsDateString). Mensajes: `"date es obligatoria"`, `"date debe ser una fecha válida en formato YYYY-MM-DD"`.
  - `serviceId`: string, UUID. Mensajes: `"serviceId es obligatorio"`, `"serviceId debe ser un UUID válido"`.

- **Validación en servicio:**
  - Si `date` no es fecha válida → **400** `"Fecha inválida. Use formato YYYY-MM-DD."`.
  - Si `date` &lt; hoy (en zona `APPOINTMENTS_TIMEZONE`, por defecto `America/Mexico_City`) → **400** `"La fecha debe ser igual o posterior a la fecha actual."`.
  - Si barbero no existe o no está activo → **404** `"Barbero no encontrado o inactivo"`.
  - Si servicio no existe o no está activo → **404** `"Servicio no encontrado o inactivo"`.

- **Respuesta 200:** Tipo `AvailableSlotsResult`:
  - `date`: string (YYYY-MM-DD, el del query).
  - `barberId`: string.
  - `serviceId`: string.
  - `durationMinutes`: number (del servicio).
  - `slots`: array de `{ "time": "HH:mm", "reason": SlotReason }`.
  - `available`: array de strings "HH:mm" (slots con `reason === 'AVAILABLE'`).
  - `occupied`: array de strings "HH:mm" (resto).

Valores de `reason` (constante `SLOT_REASON` en backend): `AVAILABLE`, `OUT_OF_WORKING_HOURS`, `BARBER_BREAK`, `OCCUPIED_BY_APPOINTMENT`, `TEMPORARILY_LOCKED`.

Si hay excepción de calendario (HOLIDAY/CLOSED) o el barbero no tiene horario ese día: `slots: []`, `available: []`, `occupied: []`.

Ejemplo 200:

```json
{
  "date": "2026-02-15",
  "barberId": "33333333-3333-3333-3333-333333333301",
  "serviceId": "22222222-2222-2222-2222-222222222201",
  "durationMinutes": 30,
  "slots": [
    { "time": "09:00", "reason": "AVAILABLE" },
    { "time": "09:30", "reason": "AVAILABLE" },
    { "time": "10:00", "reason": "OCCUPIED_BY_APPOINTMENT" },
    { "time": "10:30", "reason": "BARBER_BREAK" },
    { "time": "11:00", "reason": "TEMPORARILY_LOCKED" }
  ],
  "available": ["09:00", "09:30"],
  "occupied": ["10:00", "10:30", "11:00"]
}
```

---

### 2.4 POST `/api/appointments/slot-lock`

- **Controlador:** `createSlotLock`, `@Post('slot-lock')`, `@UseGuards(JwtAuthGuard)`, `@HttpCode(HttpStatus.OK)` (200).
- **Auth:** JWT obligatorio.
- **Body:** `CreateSlotLockDto` (JSON):
  - `barberId`: string, obligatorio, UUID.
  - `serviceId`: string, obligatorio, UUID.
  - `date`: string, obligatorio, IsDateString (ISO 8601). Mensaje: `"date debe ser una fecha y hora válida en formato ISO"`, `"date es obligatoria"`.

- **Validación en servicio:**
  - Si `date` no es válida → **400** `"Fecha y hora inválidas. Use formato ISO 8601."`.
  - Si el slot no está en `available` (según `getAvailableSlots(..., userId)`):
    - Si `reason === 'TEMPORARILY_LOCKED'` → **409** con body `{ "code": "TEMPORARILY_LOCKED", "message": "Este horario está temporalmente reservado por otro usuario. Intente en unos minutos." }`.
    - En otro caso → **400** `"El horario {timeStr} no está disponible ({reason})."` (ej. `OUT_OF_WORKING_HOURS`, `OCCUPIED_BY_APPOINTMENT`).
  - Si ya existe un lock activo del mismo slot y `lockedByUserId !== userId` → **409** mismo objeto con `code: 'TEMPORARILY_LOCKED'`.

- **Respuesta 200:** `{ "lockId": string (uuid), "expiresAt": Date }` (ISO string en JSON).

---

### 2.5 POST `/api/appointments`

- **Controlador:** `createAppointment`, `@Post()`, `@UseGuards(JwtAuthGuard)`, `@HttpCode(HttpStatus.CREATED)` (201).
- **Auth:** JWT obligatorio.
- **Body:** `CreateAppointmentDto` (JSON):
  - `barberId`: string, obligatorio, UUID.
  - `serviceId`: string, obligatorio, UUID.
  - `date`: string, obligatorio, IsDateString (ISO 8601).
  - `notes`: string opcional, max 500 caracteres (`@MaxLength(500)`).

- **Validación en servicio (orden):**
  1. **Penalización:** Si el usuario tiene ≥3 cancelaciones en los últimos 30 días, bloqueo 14 días desde la 3.ª cancelación. Si `now < blockEnd` → **403** con mensaje exacto: `"No puede crear citas: ha cancelado 3 veces en los últimos 30 días. Bloqueo hasta {YYYY-MM-DD}."`.
  2. Fecha/hora inválida → **400** `"Fecha y hora inválidas. Use formato ISO 8601."`.
  3. Día de la cita (en `APPOINTMENTS_TIMEZONE`) &lt; hoy → **400** `"La fecha de la cita debe ser hoy o un día futuro."`.
  4. Cita antes de now + 30 min → **400** `"La cita debe ser al menos 30 minutos después de la hora actual"`.
  5. Slot no disponible (según `getAvailableSlots` con `userId`): si reason `TEMPORARILY_LOCKED` → **409** `{ "code": "TEMPORARILY_LOCKED", "message": "Este horario está temporalmente reservado por otro usuario. Intente en unos minutos." }`; si no → **409** `"Lo sentimos, este horario acaba de ser reservado"` (sin `code`).
  6. Lock activo de otro usuario para ese slot → **409** mismo objeto con `code: 'TEMPORARILY_LOCKED'`.
  7. Servicio no encontrado → **404** `"Servicio no encontrado"`. (Barbero se valida implícitamente en getAvailableSlots; si falla ahí se devuelve 404 "Barbero no encontrado o inactivo" antes de llegar a crear.)
  8. **Límite de horario:** Si el fin de la cita (fecha + `service.durationMinutes`) excede la hora de cierre del barbero ese día (`BarberWorkSchedule.endTime`, en zona `APPOINTMENTS_TIMEZONE`) → **400** `"El servicio seleccionado excede el horario laboral del barbero"`.
  9. **Misma persona, mismo horario:** Si el usuario ya tiene una cita en estado PENDING o ACCEPTED que se solapa con el nuevo bloque (mismo día; se usan límites exclusivos: fin de una = inicio de la otra se permite) → **409** `"Ya tienes una cita programada que se solapa con este horario"`.
  10. Solapamiento con otra cita del barbero en transacción → **409** `"Lo sentimos, este horario acaba de ser reservado"`.
  11. Serialization/conflict Prisma (P2034 o mensaje de conflicto) → **409** mismo mensaje.

- **Respuesta 201:** Objeto **Appointment** (Prisma), sin `include`. Campos: `id`, `date`, `status`, `notes`, `rejectionReason`, `reminderSent`, `loyaltyPointsAwarded`, `userId`, `barberId`, `serviceId`, `createdAt`, `updatedAt`. Tras crear, el backend intenta enviar confirmación por WhatsApp (si falla solo se registra en log; no cambia el 201).

Ejemplo 201:

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "date": "2026-02-15T09:00:00.000Z",
  "status": "PENDING",
  "notes": "Corte bajo por los lados",
  "rejectionReason": null,
  "reminderSent": false,
  "loyaltyPointsAwarded": false,
  "userId": "770e8400-e29b-41d4-a716-446655440002",
  "barberId": "33333333-3333-3333-3333-333333333301",
  "serviceId": "22222222-2222-2222-2222-222222222201",
  "createdAt": "2026-02-15T08:58:00.000Z",
  "updatedAt": "2026-02-15T08:58:00.000Z"
}
```

---

### 2.6 PATCH `/api/appointments/:id/status`

- **Controlador:** `updateAppointmentStatus`, `@Patch(':id/status')`, `@UseGuards(JwtAuthGuard, RolesGuard)`, `@Roles(ROLES.ADMIN, ROLES.BARBER, ROLES.USER)`.
- **Auth:** JWT + rol **ADMIN**, **BARBER** o **USER**.
- **Param:** `id` (id de la cita).
- **Body:** `UpdateAppointmentStatusDto`:
  - `status`: obligatorio, uno de `ACCEPTED`, `REJECTED`, `CANCELLED`, `COMPLETED` (no se puede volver a PENDING). Validación: `"status debe ser ACCEPTED, REJECTED, CANCELLED o COMPLETED"`.
  - `rejectionReason`: opcional string, max 500; **obligatorio en lógica** cuando `status === 'REJECTED'`.

- **Permisos por rol:**
  - **USER:** solo puede poner `status: CANCELLED` y solo en sus propias citas (`appointment.userId === user.userId`). No puede ACCEPTED, REJECTED ni COMPLETED.
  - **BARBER:** solo citas de su barbero; puede ACCEPTED, REJECTED, CANCELLED, COMPLETED.
  - **ADMIN:** cualquier cita y cualquier transición.

- **Validación en servicio:**
  - Cita no encontrada → **404** `"Cita con id {id} no encontrada"`.
  - USER y `appointment.userId !== user.userId` → **403** `"Solo puede cancelar sus propias citas"`.
  - USER y `dto.status !== 'CANCELLED'` → **403** `"Solo puede cancelar sus citas. No puede aceptar, rechazar ni marcar como completada."`.
  - BARBER y (`!user.barberId` o `appointment.barberId !== user.barberId`) → **403** `"Solo puede cambiar el estado de sus propias citas"`.
  - Rol distinto de USER, BARBER y ADMIN → **403** `"No tiene permiso para actualizar el estado de citas"`.
  - Transición no permitida (tabla de transiciones) → **400** `"No se puede pasar de {estadoActual} a {dto.status}"`.
  - `status === 'REJECTED'` y rejectionReason vacío/trim → **400** `"rejectionReason es obligatorio cuando el estado es REJECTED"`.
  - COMPLETED→CANCELLED → **400** `"No se puede cancelar una cita ya completada"`.
  - `status === 'COMPLETED'` y fecha de la cita &gt; hoy (solo día) → **400** `"Solo se puede marcar como completada una cita cuya fecha sea hoy o anterior"`.
  - `status === 'CANCELLED'` y faltan &lt; 2 h para la cita → **400** `"No se puede cancelar una cita con menos de 2 horas de antelación"`.

- **Respuesta 200:** Objeto **Appointment** actualizado (todos los campos Prisma). Si se pasa a REJECTED se guarda `rejectionReason`; si se pasa a otro estado se pone `rejectionReason: null`. Al pasar ACCEPTED→COMPLETED por primera vez se incrementan `loyaltyPoints` y `totalVisits` del usuario y `loyaltyPointsAwarded: true` en la cita.

---

## 3. Lógica sugerida para UI/UX (slots por día)

A partir de la respuesta de **GET `/api/appointments/available-slots`** (`slots[].reason`), el front puede mostrar un estado visual del día para mejorar la experiencia de usuario:

| Estado visual | Condición | Interpretación |
|---------------|-----------|-----------------|
| **Verde (Disponible)** | Al menos un slot tiene `reason: "AVAILABLE"`. | El usuario puede elegir horario sin restricción. |
| **Naranja (Advertencia)** | No hay ningún slot con `reason: "AVAILABLE"`, pero sí hay al menos uno con `reason: "TEMPORARILY_LOCKED"`. | No hay disponibilidad confirmada; otro usuario puede estar reservando. Mostrar mensaje tipo “Pocos horarios disponibles; intente de nuevo en unos minutos”. |
| **Rojo (Ocupado / Bloqueado)** | Todos los slots tienen `reason` en `"OCCUPIED_BY_APPOINTMENT"`, `"BARBER_BREAK"` o `"OUT_OF_WORKING_HOURS"`. | Sin disponibilidad ese día; sugerir otra fecha. |

- Si `slots` está vacío (excepción de calendario o sin horario): tratar como **no disponible** (equivalente a Rojo).
- Esta lógica es **sugerida**; el backend no impone estos estados. El front puede combinar `available` y `occupied` con los `reason` para animaciones, badges o deshabilitar días completos.

---

## 4. Formato estándar de errores HTTP

Filtro global: `HttpExceptionFilter`. Todas las respuestas de error tienen esta forma (interfaz `HttpExceptionResponseBody`):

```json
{
  "statusCode": number,
  "timestamp": string (ISO),
  "path": string (request.url, ej. /api/appointments/my),
  "message": string | string[],
  "code": string (solo si el backend envía code, ej. "TEMPORARILY_LOCKED")
}
```

En `NODE_ENV !== 'production'` puede existir además `errorResponse` (objeto crudo); no usarlo en producción.

Cuando el backend lanza `ConflictException({ code: 'TEMPORARILY_LOCKED', message: '...' })`, el filtro incluye `code` en el body.

---

## 5. Tabla de errores por endpoint (mensajes exactos del backend)

| HTTP | Endpoint | Condición | `message` (literal o patrón) | `code` (si aplica) |
|------|----------|-----------|------------------------------|---------------------|
| 400 | available-slots | Fecha inválida | `Fecha inválida. Use formato YYYY-MM-DD.` | — |
| 400 | available-slots | Fecha &lt; hoy (en TZ negocio) | `La fecha debe ser igual o posterior a la fecha actual.` | — |
| 400 | slot-lock | Fecha/hora inválida | `Fecha y hora inválidas. Use formato ISO 8601.` | — |
| 400 | slot-lock | Horario no disponible | `El horario {HH:mm} no está disponible ({reason}).` | — |
| 400 | POST appointments | Fecha/hora inválida | `Fecha y hora inválidas. Use formato ISO 8601.` | — |
| 400 | POST appointments | Día cita &lt; hoy | `La fecha de la cita debe ser hoy o un día futuro.` | — |
| 400 | POST appointments | &lt; 30 min antelación | `La cita debe ser al menos 30 minutos después de la hora actual` | — |
| 400 | POST appointments | EndTime excede cierre barbero | `El servicio seleccionado excede el horario laboral del barbero` | — |
| 400 | PATCH status | Transición no permitida | `No se puede pasar de {X} a {Y}` | — |
| 400 | PATCH status | REJECTED sin rejectionReason | `rejectionReason es obligatorio cuando el estado es REJECTED` | — |
| 400 | PATCH status | COMPLETED→CANCELLED | `No se puede cancelar una cita ya completada` | — |
| 400 | PATCH status | COMPLETED con fecha futura | `Solo se puede marcar como completada una cita cuya fecha sea hoy o anterior` | — |
| 400 | PATCH status | CANCELLED con &lt; 2 h | `No se puede cancelar una cita con menos de 2 horas de antelación` | — |
| 401 | Cualquier ruta con JWT | No token / token inválido | (según guard auth) | — |
| 403 | POST appointments | Penalización cancelaciones | `No puede crear citas: ha cancelado 3 veces en los últimos 30 días. Bloqueo hasta {YYYY-MM-DD}.` | — |
| 403 | GET barber | Usuario sin barberId | `Usuario barbero sin perfil de barbero asignado` | — |
| 403 | PATCH status | USER no es dueño de la cita | `Solo puede cancelar sus propias citas` | — |
| 403 | PATCH status | USER intenta estado distinto de CANCELLED | `Solo puede cancelar sus citas. No puede aceptar, rechazar ni marcar como completada.` | — |
| 403 | PATCH status | BARBER otra cita | `Solo puede cambiar el estado de sus propias citas` | — |
| 403 | PATCH status | Rol no USER/BARBER/ADMIN | `No tiene permiso para actualizar el estado de citas` | — |
| 404 | available-slots | Barbero no encontrado/inactivo | `Barbero no encontrado o inactivo` | — |
| 404 | available-slots | Servicio no encontrado/inactivo | `Servicio no encontrado o inactivo` | — |
| 404 | POST appointments | Servicio no encontrado | `Servicio no encontrado` | — |
| 404 | PATCH status | Cita no existe | `Cita con id {id} no encontrada` | — |
| 409 | slot-lock / POST appointments | Slot bloqueado por otro | `Este horario está temporalmente reservado por otro usuario. Intente en unos minutos.` | `TEMPORARILY_LOCKED` |
| 409 | POST appointments | Slot ocupado/colisión | `Lo sentimos, este horario acaba de ser reservado` | — |
| 409 | POST appointments | Cita del usuario solapada (mismo horario) | `Ya tienes una cita programada que se solapa con este horario` | — |
| 500 | Cualquiera | Error no controlado | `Ha ocurrido un error interno. Por favor, inténtelo de nuevo más tarde.` | — |

Validación de DTOs (ValidationPipe con `whitelist: true`, `forbidNonWhitelisted: true`): propiedades no permitidas o fallos de class-validator devuelven 400; el `message` puede ser string o array de mensajes (p. ej. `"barberId es obligatorio"`).

---

## 6. Resumen de rutas y métodos

| Método | Ruta completa | Auth | Descripción breve |
|--------|----------------|------|-------------------|
| GET | `/api/appointments/my` | JWT | Mis citas (con barber, service, totalEstimatedMinutes, servicePrice). Query opcional: `date`. |
| GET | `/api/appointments/barber` | JWT + BARBER | Citas del barbero (con user, service). Query opcional: `date`. |
| GET | `/api/appointments/available-slots` | No | Slots del día con `reason`; query: barberId, date, serviceId. |
| POST | `/api/appointments/slot-lock` | JWT | Bloquear slot 5 min. Body: barberId, serviceId, date. |
| POST | `/api/appointments` | JWT | Crear cita. Body: barberId, serviceId, date, notes (opcional). |
| PATCH | `/api/appointments/:id/status` | JWT + ADMIN, BARBER o USER | Cambiar estado. USER: solo CANCELLED en sus citas. ADMIN/BARBER: ACCEPTED, REJECTED, CANCELLED, COMPLETED. Body: status, rejectionReason (obligatorio si status=REJECTED). |

No existe en el controlador ninguna ruta `GET /api/appointments/my-appointments`; la ruta de “mis citas” es **GET `/api/appointments/my`**.

---

## 7. Constantes de negocio (backend)

- Buffer entre citas: **10** min (`BUFFER_TIME_MINUTES`).
- Antelación mínima para crear cita: **30** min (`MIN_ADVANCE_BOOKING_MINUTES`).
- Cancelar cita: mínimo **2** h antes (`MIN_HOURS_BEFORE_APPOINTMENT_TO_CANCEL`).
- Bloqueo de slot: **5** min (`SLOT_LOCK_MINUTES`).
- Penalización: **3** cancelaciones en **30** días → bloqueo **14** días (`CANCELLATION_PENALTY_DAYS`, `CANCELLATION_PENALTY_COUNT`, `PENALTY_BLOCK_DAYS`).
- Zona horaria para “hoy” y horas de slots: `APPOINTMENTS_TIMEZONE` (env), por defecto `America/Mexico_City`.

---

*Documento generado a partir del código en `src/appointments/`, `prisma/schema.prisma`, `src/main.ts` y `src/common/filters/http-exception.filter.ts`. Sin suposiciones; solo contratos y mensajes reales del backend.*
