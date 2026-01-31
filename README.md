# NestJS Auth Boilerplate — Seguridad de Grado Empresarial

Una **base sólida** para proyectos NestJS con autenticación, autorización y controles de seguridad listos para producción. Diseñado para servir como cimiento reutilizable en APIs, SaaS o backends que exigen estándares de seguridad elevados y una arquitectura clara.

---

## Descripción

Este **boilerplate genérico de autenticación y seguridad** ofrece:

- **Seguridad de grado empresarial**: JWT con rotación de refresh tokens, contraseñas hasheadas con bcrypt, verificación por OTP y protección frente a fuerza bruta.
- **Arquitectura reutilizable**: modelo de usuario minimalista (solo `User`), roles ADMIN/USER y flujos desacoplados para integrar con cualquier dominio de negocio.
- **Listo para portafolio**: código estructurado, documentación Swagger, buenas prácticas (DTOs, guards, manejo de excepciones) y sin lógica de negocio específica.

Ideal para arrancar nuevos proyectos NestJS, demostrar competencias en backend seguro o como referencia de implementación de auth en Node.js.

---

## Stack Tecnológico

| Tecnología           | Uso                                           |
|----------------------|-----------------------------------------------|
| **NestJS**           | Framework backend, módulos, guards, DTOs     |
| **Prisma 7**        | ORM con Driver Adapter (PostgreSQL)           |
| **PostgreSQL**      | Base de datos principal                       |
| **JWT** (@nestjs/jwt) | Access y refresh tokens, firma y verificación |
| **Bcrypt**           | Hash de contraseñas (salt rounds: 10)         |
| **Throttler**       | Rate limiting global y por ruta                |
| **Passport**        | Estrategia JWT para autenticación             |
| **class-validator** | Validación de DTOs                            |
| **Swagger (OpenAPI)** | Documentación de API y Bearer JWT           |

---

## Características Implementadas

### Seguridad Élite: Access & Refresh Tokens con rotación automática

- **Access Token**: JWT con expiración de **1 hora** (configurable con `JWT_ACCESS_EXPIRES_IN`). Incluye `sub` (userId), `email` y `role`. Uso típico en header `Authorization: Bearer <token>`.
- **Refresh Token**: JWT de **7 días** con `jti` (UUID) persistido en el modelo `User`. En cada `POST /auth/refresh` se valida el token contra BD y se emite un **nuevo par** (Token Rotation); el refresh anterior queda invalidado.
- **Logout**: `POST /auth/logout` limpia el `refreshToken` en BD, cerrando la sesión de forma segura.

### WhatsApp OTP: Verificación y recuperación de cuenta (simulado)

- **Registro**: se crea un `User` (rol USER), se genera un OTP de 6 dígitos (expira en 10 min) y se “envía” por WhatsApp; por ahora el mensaje se imprime en consola del servidor para pruebas sin integración real.
- **Verificación**: `POST /auth/verify-whatsapp` (email + code) marca `isVerified = true` y limpia el código. El login solo se permite con cuenta verificada.
- **Reenvío de OTP**: `POST /auth/resend-otp` (email) genera un nuevo código y actualiza la expiración; respuesta genérica para evitar user enumeration.
- **Recuperación de contraseña**: `POST /auth/forgot-password` (email) y `POST /auth/reset-password` (email, code, newPassword) usan campos independientes del OTP de verificación.

### Protección Anti-Spam: Rate limiting en rutas sensibles

- **Global**: 100 peticiones/minuto por defecto (ThrottlerGuard como `APP_GUARD`).
- **Rutas sensibles**: **5 peticiones por minuto** en `login`, `verify-whatsapp`, `reset-password` y `resend-otp` para limitar fuerza bruta y abuso. Respuesta **429 Too Many Requests** al superar el límite.

### Roles (RBAC): Jerarquía ADMIN y USER lista para usar

- **Roles**: `ADMIN` y `USER` (enum en Prisma; nuevo usuario por defecto: `USER`).
- **Decoradores**: `@Public()` (ruta sin JWT), `@Roles(ROLES.ADMIN)` o `@Roles(ROLES.USER)` (junto a `RolesGuard`), `@CurrentUser()` (inyecta userId, email, role).
- **Guards**: `JwtAuthGuard` global (todas las rutas protegidas salvo `@Public()`); `RolesGuard` para restringir por rol.

---

## Guía de Inicio

### 1. Clonar e instalar dependencias

```bash
git clone <repo>
cd <proyecto>
npm install
```

### 2. Configurar variables de entorno

Copia el archivo de ejemplo y rellena los valores (nunca subas `.env` al repositorio):

```bash
cp .env.example .env
```

Edita `.env` con al menos:

| Variable        | Obligatoria | Descripción |
|-----------------|-------------|-------------|
| `DATABASE_URL`  | Sí          | URL de PostgreSQL (ej. `postgresql://user:pass@localhost:5432/mi_db`) |
| `JWT_SECRET`    | Sí          | Clave secreta para firmar JWTs (larga y aleatoria en producción) |
| `JWT_ACCESS_EXPIRES_IN` | No  | Expiración del access token en segundos (por defecto: 3600) |
| `PORT`          | No          | Puerto del servidor (por defecto: 3000) |

### 3. Base de datos: migraciones y seed

Aplicar migraciones (Prisma 7):

```bash
npx prisma migrate deploy
```

Cargar usuario de prueba (ADMIN, verificado):

```bash
npx prisma db seed
```

Credenciales por defecto: **admin@example.com** / **Admin#123**.

### 4. Arrancar la aplicación

```bash
# Desarrollo (watch)
npm run start:dev

# Producción
npm run build
npm run start:prod
```

- **API**: `http://localhost:3000/api`
- **Swagger**: `http://localhost:3000/docs` — usar **Authorize** con el token devuelto por `POST /auth/login` para probar rutas protegidas.

---

## Documentación de API (Swagger)

La API está documentada en **OpenAPI** en la ruta `/docs`. Incluye:

- Descripción de cada endpoint de auth (login, register, verify-whatsapp, refresh, logout, change-password, resend-otp, forgot-password, reset-password, me).
- Esquema Bearer JWT (`access_token`); uso del botón **Authorize** para enviar el token en las peticiones protegidas.
- Códigos de respuesta documentados: 200, 201, 400, 401, 403, 409, 429.

---

## Estructura del Módulo de Autenticación

```
src/auth/
├── auth.controller.ts   # Endpoints públicos y protegidos
├── auth.service.ts      # Lógica: tokens, OTP, cambio de contraseña, perfil
├── auth.module.ts       # JwtModule, PassportModule, JwtStrategy
├── constants/roles.ts    # ROLES (ADMIN, USER)
├── decorators/          # @Public(), @Roles(), @CurrentUser()
├── dto/                 # LoginDto, RegisterDto, VerifyWhatsAppDto, etc.
├── guards/              # JwtAuthGuard, RolesGuard
├── interceptors/        # ThrottlerLoggingInterceptor (log temporal)
└── strategies/          # JwtStrategy
```

---

## Mejores Prácticas Implementadas

- **DTOs y validación**: todos los cuerpos validados con `class-validator`; `ValidationPipe` global con `whitelist` y `forbidNonWhitelisted`.
- **Seguridad por defecto**: rutas protegidas por JWT; contraseñas y tokens sensibles nunca expuestos en respuestas; refresh token almacenado como `jti` para rotación y logout.
- **Manejo de excepciones**: códigos HTTP claros (401, 403, 409, 429) y mensajes genéricos donde se evita user enumeration (forgot-password, resend-otp).
- **Código mantenible**: constantes para roles y tiempos; separación entre servicios, guards y estrategias; modelo de datos minimalista (solo `User`).

---

## Licencia

UNLICENSED (proyecto privado). Ajustar según la política de tu organización.
