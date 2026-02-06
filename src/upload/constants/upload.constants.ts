/**
 * Constantes para el módulo de upload de imágenes.
 */
export const UPLOAD = {
  /** Tamaño máximo por archivo: 5 MB */
  MAX_FILE_SIZE: 5 * 1024 * 1024,
  /** MIME types permitidos */
  ALLOWED_MIME_TYPES: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ] as const,
  /** Extensiones permitidas (para validar nombre) */
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp'] as const,
} as const;
