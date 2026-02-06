# Módulo Landing

Módulo CMS para la configuración dinámica de la landing page de la barbería.

## Estructura

```
landing/
├── constants/           # Constantes (IDs, etc.)
├── controllers/         # Controladores (público + admin)
├── dto/                 # DTOs de request y response
├── services/            # Lógica de negocio
├── utils/               # Utilidades
└── landing.module.ts
```

## Rutas públicas (`/api/landing`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/landing` | Datos completos del landing (config, barberos, servicios, galería) |

## Rutas admin (`/api/landing/admin`)

Requieren `Authorization: Bearer <access_token>` y rol `ADMIN`.

### Configuración
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/landing/admin/config` | Obtener configuración |
| PATCH | `/api/landing/admin/config` | Actualizar configuración (PATCH parcial) |

### Barberos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/landing/admin/barbers` | Listar (query: `?includeInactive=true`) |
| GET | `/api/landing/admin/barbers/:id` | Obtener por ID |
| POST | `/api/landing/admin/barbers` | Crear |
| PATCH | `/api/landing/admin/barbers/:id` | Actualizar |
| DELETE | `/api/landing/admin/barbers/:id` | Desactivar (soft delete) |

### Servicios
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/landing/admin/services` | Listar |
| GET | `/api/landing/admin/services/:id` | Obtener por ID |
| POST | `/api/landing/admin/services` | Crear |
| PATCH | `/api/landing/admin/services/:id` | Actualizar |
| DELETE | `/api/landing/admin/services/:id` | Desactivar (soft delete) |

### Galería
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/landing/admin/gallery` | Listar |
| GET | `/api/landing/admin/gallery/:id` | Obtener por ID |
| POST | `/api/landing/admin/gallery` | Crear (imageUrl, description) |
| DELETE | `/api/landing/admin/gallery/:id` | Eliminar (hard delete) |

## Soft delete

Barberos y servicios usan `isActive: false` en lugar de eliminación física. La landing pública solo muestra registros activos.
