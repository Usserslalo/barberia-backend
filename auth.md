# API de Autenticación — JC BARBER SHOP

Documentación de los endpoints de autenticación y seguridad. Base URL: `{BASE_URL}/api`. Todas las rutas de auth están bajo **`/api/auth/`**.

---

## Índice de endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Iniciar sesión |
| POST | `/api/auth/register` | Registro de usuario |
| POST | `/api/auth/verify-whatsapp` | Verificar cuenta por WhatsApp |
| POST | `/api/auth/forgot-password` | Solicitar recuperación de contraseña |
| POST | `/api/auth/reset-password` | Restablecer contraseña con código OTP |
| POST | `/api/auth/refresh` | Refrescar tokens (Token Rotation) |
| POST | `/api/auth/resend-otp` | Reenviar código OTP de verificación |
| POST | `/api/auth/logout` | Cerrar sesión |
| PATCH | `/api/auth/change-password` | Cambiar contraseña |
| GET | `/api/auth/me` | Perfil del usuario actual |

---

## Formato estándar de errores

Todas las respuestas de error pasan por el filtro global y tienen esta forma:

```json
{
  "statusCode": 429,
  "timestamp": "2026-02-04T12:00:00.000Z",
  "path": "/api/auth/login",
  "message": "ThrottlerException: Too Many Requests",
  "code": "THROTTLED"
}
```

- **statusCode:** Código HTTP (400, 401, 403, 429, 500).
- **timestamp:** ISO 8601.
- **path:** Ruta de la petición.
- **message:** Mensaje legible (string o array de cadenas cuando es error de validación DTO).
- **code:** Solo en **429** (rate limit): **`THROTTLED`**. El resto de errores no incluyen `code` por defecto.

La validación con ValidationPipe (whitelist, forbidNonWhitelisted) puede devolver 400 con `message` en array (errores de class-validator).

---

## Rate limiting

- **Por defecto:** 100 peticiones por minuto por IP (resto de rutas).
- **Estricto (5/min):** en `/api/auth/login`, `/api/auth/verify-whatsapp`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/resend-otp`. Al superar el límite: **429** con **`code: 'THROTTLED'`**.

---

## Cookie HttpOnly del refresh token

- **Nombre:** `refreshToken`.
- **Opciones:** HttpOnly, Secure en producción (`NODE_ENV === 'production'`), SameSite=Strict, path=/, maxAge 7 días.
- **Uso:** En **login** y **refresh** el servidor envía/actualiza esta cookie. En **refresh** el token se lee de la cookie (prioridad) o del body. En **logout** el servidor borra la cookie.
- **Cliente:** Las peticiones que deban enviar/recibir la cookie deben ir con credentials (`credentials: 'include'` en fetch o `withCredentials: true` en axios).

---

## POST `/api/auth/login`

Iniciar sesión. Valida email y contraseña. Devuelve **access_token (1h)** en el body y **refresh_token (7d)** en la cookie `refreshToken` (HttpOnly, Secure, SameSite=Strict). La cuenta debe estar verificada (`isVerified: true`). Rate limit: 5/min.

**Headers**

| Header       | Valor             |
|-------------|-------------------|
| Content-Type | application/json |

**Request Body**

```json
{
  "email": "carlos.mendoza@gmail.com",
  "password": "Password#467"
}
```

| Campo    | Tipo   | Obligatorio | Validación / Descripción |
|----------|--------|-------------|---------------------------|
| email    | string | Sí          | IsEmail, IsNotEmpty       |
| password | string | Sí          | IsString, IsNotEmpty, MinLength(6) |

**Responses**

| Código | Descripción |
|--------|-------------|
| **200** | OK. Body: `access_token`, `user`. Cookie: `refreshToken`. |
| **400** | Validación DTO (p. ej. email inválido, contraseña &lt; 6 caracteres). |
| **401** | Unauthorized. Mensajes posibles: "Credenciales inválidas", "Cuenta desactivada", "Debe verificar su cuenta antes de iniciar sesión. Revise su WhatsApp para el código." |
| **429** | Too Many Requests. Body incluye `code: 'THROTTLED'`. |
| **500** | "Error al procesar la solicitud" o "Error al generar tokens de autenticación" o "Error al completar la autenticación". |

**Ejemplo 200 (body)**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "carlos.mendoza@gmail.com",
    "firstName": "Carlos",
    "lastName": "Mendoza",
    "phone": "+5215512345678",
    "role": "USER"
  }
}
```

El refresh token va en la cookie `refreshToken`, no en el body.

---

## POST `/api/auth/register`

Registro de usuario. Rol por defecto: USER. Crea el usuario, envía OTP por WhatsApp y devuelve **access_token**, **refresh_token** y **user** en el body (el register no usa cookie para el refresh token; el body incluye `refresh_token`). Si el correo ya existe: 409. Rate limit: el global (100/min); no tiene throttle estricto.

**Headers**

| Header       | Valor             |
|-------------|-------------------|
| Content-Type | application/json |

**Request Body**

```json
{
  "email": "usuario@ejemplo.com",
  "firstName": "Juan",
  "lastName": "Pérez",
  "phone": "+5215512345678",
  "password": "MiClave#123"
}
```

| Campo     | Tipo   | Obligatorio | Validación / Descripción |
|-----------|--------|-------------|---------------------------|
| email     | string | Sí          | IsEmail, IsNotEmpty |
| firstName | string | Sí          | IsString, IsNotEmpty |
| lastName  | string | Sí          | IsString, IsNotEmpty |
| phone     | string | Sí          | IsString, IsNotEmpty, Matches E.164 (ej. +5215512345678) |
| password  | string | Sí          | IsString, IsNotEmpty, MinLength(6), al menos una letra y un número |

**Responses**

| Código | Descripción |
|--------|-------------|
| **201** | Created. Body: `access_token`, `refresh_token`, `user`. |
| **400** | Validación DTO. |
| **409** | "Ya existe un usuario registrado con este correo electrónico". |
| **500** | "Error al procesar el registro", "Error al crear la cuenta". |

**Ejemplo 201**

```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "user": {
    "id": "uuid",
    "email": "usuario@ejemplo.com",
    "firstName": "Juan",
    "lastName": "Pérez",
    "phone": "+5215512345678",
    "role": "USER"
  }
}
```

---

## POST `/api/auth/verify-whatsapp`

Verificar cuenta con el OTP de 6 dígitos enviado por WhatsApp. Si el código es correcto y no ha expirado (10 min), se pone `isVerified: true` y se limpian `verificationCode` y `verificationExpires`. Rate limit: 5/min.

**Headers**

| Header       | Valor             |
|-------------|-------------------|
| Content-Type | application/json |

**Request Body**

```json
{
  "email": "usuario@example.com",
  "code": "123456"
}
```

| Campo | Tipo   | Obligatorio | Validación / Descripción |
|-------|--------|-------------|---------------------------|
| email | string | Sí          | IsEmail, IsNotEmpty |
| code  | string | Sí          | IsString, IsNotEmpty, Length(6,6), Matches(/^\d{6}$/) |

**Responses**

| Código | Descripción |
|--------|-------------|
| **200** | OK. Body: `{ "message": "Cuenta verificada correctamente. Ya puede iniciar sesión." }`. |
| **400** | "No hay código pendiente de verificación. Solicite uno nuevo registrándose." o "El código ha expirado. Solicite uno nuevo." |
| **401** | "Usuario no encontrado" o "Código de verificación incorrecto". |
| **429** | Too Many Requests. Body incluye `code: 'THROTTLED'`. |
| **500** | "Error al procesar la solicitud" o "Error al verificar la cuenta". |

---

## POST `/api/auth/forgot-password`

Solicitar recuperación de contraseña. Si el email está registrado, se envía un OTP por WhatsApp (válido 10 min). Siempre responde 200 con el mismo mensaje (no revela si el email existe). Rate limit: 5/min.

**Headers**

| Header       | Valor             |
|-------------|-------------------|
| Content-Type | application/json |

**Request Body**

```json
{
  "email": "usuario@ejemplo.com"
}
```

| Campo | Tipo   | Obligatorio | Validación / Descripción |
|-------|--------|-------------|---------------------------|
| email | string | Sí          | IsEmail, IsNotEmpty |

**Responses**

| Código | Descripción |
|--------|-------------|
| **200** | OK. Body: `{ "message": "Si el correo está registrado, recibirá un código por WhatsApp en breve." }`. |
| **400** | Validación DTO. |
| **429** | Too Many Requests. Body incluye `code: 'THROTTLED'`. |
| **500** | En caso de error interno se devuelve igual el mensaje genérico 200 (no se revela fallo). |

---

## POST `/api/auth/reset-password`

Restablecer contraseña con el código OTP recibido por WhatsApp. Se valida que el código no haya expirado y coincida; luego se actualiza la contraseña y se limpian `resetPasswordCode` y `resetPasswordExpires`. Rate limit: 5/min.

**Headers**

| Header       | Valor             |
|-------------|-------------------|
| Content-Type | application/json |

**Request Body**

```json
{
  "email": "usuario@ejemplo.com",
  "code": "123456",
  "newPassword": "NuevaClave#456"
}
```

| Campo       | Tipo   | Obligatorio | Validación / Descripción |
|-------------|--------|-------------|---------------------------|
| email       | string | Sí          | IsEmail, IsNotEmpty |
| code        | string | Sí          | IsString, IsNotEmpty, Length(6,6), Matches(/^\d{6}$/) |
| newPassword | string | Sí          | IsString, IsNotEmpty, MinLength(6), al menos una letra y un número |

**Responses**

| Código | Descripción |
|--------|-------------|
| **200** | OK. Body: `{ "message": "Contraseña restablecida correctamente. Ya puede iniciar sesión." }`. |
| **400** | "Código inválido o expirado. Solicite uno nuevo." o "No hay código de restablecimiento pendiente. Solicite uno nuevo." o "El código ha expirado. Solicite uno nuevo." o validación de newPassword. |
| **401** | "Código de restablecimiento incorrecto". |
| **429** | Too Many Requests. Body incluye `code: 'THROTTLED'`. |
| **500** | "Error al procesar la solicitud" o "Error al restablecer contraseña". |

---

## POST `/api/auth/refresh`

Token Rotation. El refresh token se toma de la cookie `refreshToken` (prioridad) o del body `refreshToken` (opcional). Se valida y se compara el `jti` con el guardado en BD. Se emite nuevo access_token (1h) en el body y nuevo refresh_token (7d) en la cookie; se invalida el anterior. No requiere Bearer.

**Headers**

| Header       | Valor             |
|-------------|-------------------|
| Content-Type | application/json |

**Request Body**

Opcional si se envía la cookie. Si no hay cookie, puede enviarse:

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

| Campo        | Tipo   | Obligatorio | Descripción |
|--------------|--------|-------------|-------------|
| refreshToken | string | No          | Opcional si la cookie `refreshToken` está presente. Prioridad: cookie > body. |

**Responses**

| Código | Descripción |
|--------|-------------|
| **200** | OK. Body: `access_token`, `user`. Cookie: nuevo `refreshToken`. |
| **400** | Validación DTO (p. ej. body con campos no permitidos). |
| **401** | "Refresh token no presente" (cuando no hay cookie ni body válido), o "Refresh token inválido", "Refresh token inválido o expirado", "Refresh token inválido", "Refresh token inválido o ya utilizado", "Cuenta desactivada". |
| **500** | "Error al procesar la solicitud". |

**Ejemplo 200 (body)**

```json
{
  "access_token": "eyJ...",
  "user": {
    "id": "uuid",
    "email": "usuario@ejemplo.com",
    "firstName": "Juan",
    "lastName": "Pérez",
    "phone": "+5215512345678",
    "role": "USER"
  }
}
```

El nuevo refresh token va en la cookie `refreshToken`.

---

## POST `/api/auth/resend-otp`

Reenviar código OTP de verificación. Genera un nuevo `verificationCode`, actualiza `verificationExpires` (10 min) y envía por WhatsApp. Siempre responde 200 con el mismo mensaje (no revela si el email existe o si se reenvió). Rate limit: 5/min.

**Headers**

| Header       | Valor             |
|-------------|-------------------|
| Content-Type | application/json |

**Request Body**

```json
{
  "email": "usuario@ejemplo.com"
}
```

| Campo | Tipo   | Obligatorio | Validación / Descripción |
|-------|--------|-------------|---------------------------|
| email | string | Sí          | IsEmail, IsNotEmpty |

**Responses**

| Código | Descripción |
|--------|-------------|
| **200** | OK. Body: `{ "message": "Si el correo está registrado y tiene un código pendiente, recibirá uno nuevo por WhatsApp." }`. |
| **400** | Validación DTO. |
| **429** | Too Many Requests. Body incluye `code: 'THROTTLED'`. |
| **500** | En caso de error se devuelve igual el mensaje genérico 200. |

---

## POST `/api/auth/logout`

Cerrar sesión. Requiere Bearer Token. Limpia `refreshToken` del usuario en BD y elimina la cookie `refreshToken`.

**Headers**

| Header         | Valor                   |
|----------------|-------------------------|
| Authorization  | Bearer \<access_token\> |
| Content-Type   | application/json       |

**Request Body**

Ninguno.

**Responses**

| Código | Descripción |
|--------|-------------|
| **200** | OK. Body: `{ "message": "Sesión cerrada correctamente." }`. |
| **401** | Token inválido o expirado (JWT o usuario inactivo/no verificado). |
| **500** | "Error al cerrar sesión". |

---

## PATCH `/api/auth/change-password`

Cambiar contraseña. Requiere Bearer Token. Valida la contraseña actual; si es correcta, actualiza la contraseña e invalida los refresh tokens (el usuario debe volver a iniciar sesión).

**Headers**

| Header         | Valor                   |
|----------------|-------------------------|
| Authorization  | Bearer \<access_token\> |
| Content-Type   | application/json       |

**Request Body**

```json
{
  "currentPassword": "MiClaveActual#123",
  "newPassword": "NuevaClave#456"
}
```

| Campo           | Tipo   | Obligatorio | Validación / Descripción |
|-----------------|--------|-------------|---------------------------|
| currentPassword | string | Sí          | IsString, IsNotEmpty |
| newPassword     | string | Sí          | IsString, IsNotEmpty, MinLength(6), al menos una letra y un número |

**Responses**

| Código | Descripción |
|--------|-------------|
| **200** | OK. Body: `{ "message": "Contraseña actualizada correctamente. Inicie sesión de nuevo." }`. |
| **400** | Validación DTO (p. ej. nueva contraseña no cumple requisitos). |
| **401** | "Usuario no encontrado" o "Contraseña actual incorrecta". |
| **500** | "Error al procesar la solicitud", "Error al actualizar contraseña". |

---

## GET `/api/auth/me`

Perfil del usuario autenticado. Requiere Bearer Token. Nunca devuelve el campo `password`. Los campos devueltos son los definidos en `MeResponseDto`.

**Headers**

| Header         | Valor                   |
|----------------|-------------------------|
| Authorization  | Bearer \<access_token\> |

**Request Body**

Ninguno.

**Responses**

| Código | Descripción |
|--------|-------------|
| **200** | OK. Body: `id`, `email`, `firstName`, `lastName`, `phone`, `role`, `isVerified`, y opcionalmente `barberId` (solo si el usuario tiene rol BARBER y está vinculado a un barbero). |
| **401** | "Usuario no encontrado o inactivo" (token inválido, expirado o usuario inactivo). |
| **500** | "Error al obtener el perfil". |

**Ejemplo 200**

```json
{
  "id": "uuid",
  "email": "usuario@ejemplo.com",
  "firstName": "Juan",
  "lastName": "Pérez",
  "phone": "+5215512345678",
  "role": "USER",
  "isVerified": true,
  "barberId": "uuid-barber"
}
```

`barberId` solo está presente cuando el usuario tiene rol BARBER y está vinculado a un barbero. **role** puede ser: ADMIN, USER, BARBER.

---

## Resumen de códigos HTTP por endpoint

| Endpoint               | 200/201 | 400 | 401 | 403 | 409 | 429 | 500 |
|------------------------|---------|-----|-----|-----|-----|-----|-----|
| POST /login            | ✓       | ✓   | ✓   | —   | —   | ✓   | ✓   |
| POST /register         | ✓ (201) | ✓   | —   | —   | ✓   | —   | ✓   |
| POST /verify-whatsapp  | ✓       | ✓   | ✓   | —   | —   | ✓   | ✓   |
| POST /forgot-password  | ✓       | ✓   | —   | —   | —   | ✓   | ✓   |
| POST /reset-password   | ✓       | ✓   | ✓   | —   | —   | ✓   | ✓   |
| POST /refresh          | ✓       | ✓   | ✓   | —   | —   | —   | ✓   |
| POST /resend-otp       | ✓       | ✓   | —   | —   | —   | ✓   | ✓   |
| POST /logout           | ✓       | —   | ✓   | —   | —   | —   | ✓   |
| PATCH /change-password | ✓       | ✓   | ✓   | —   | —   | —   | ✓   |
| GET /me                | ✓       | —   | ✓   | —   | —   | —   | ✓   |

En todas las respuestas **429** el body incluye **`code: 'THROTTLED'`**.
