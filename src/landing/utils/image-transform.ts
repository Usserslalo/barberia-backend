/**
 * Utilidades para transformar URLs de imágenes en CDNs (Cloudinary, S3) con parámetros
 * de tamaño y formato. Si la URL no es de un CDN soportado, se devuelve sin cambios.
 */

/** Parámetros opcionales de transformación de imagen. */
export interface ImageTransformParams {
  width?: number;
  height?: number;
  /** Formato deseado, ej. "webp". Cloudinary: f_webp. */
  format?: 'webp' | 'auto';
}

/**
 * Comprueba si la URL es de Cloudinary (res.cloudinary.com o upload.cloudinary.com).
 */
function isCloudinaryUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    return u.hostname === 'res.cloudinary.com' || u.hostname === 'upload.cloudinary.com';
  } catch {
    return false;
  }
}

/**
 * Transforma una URL de Cloudinary añadiendo segmento de transformación.
 * Formato: /upload/<transform>/v123/public_id.ext
 * Ejemplo: w_500,h_500,c_fill,f_webp para 500x500, fill, WebP.
 */
function transformCloudinaryUrl(url: string, params: ImageTransformParams): string {
  const parts: string[] = [];
  if (params.width != null) parts.push(`w_${params.width}`);
  if (params.height != null) parts.push(`h_${params.height}`);
  if (params.width != null || params.height != null) parts.push('c_fill'); // crop fill por defecto
  if (params.format === 'webp') parts.push('f_webp');
  if (params.format === 'auto') parts.push('f_auto'); // Cloudinary elige mejor formato

  if (parts.length === 0) return url;

  const transform = parts.join(',');
  // Insertar después de /upload/ el segmento de transformación
  const uploadIdx = url.indexOf('/upload/');
  if (uploadIdx === -1) return url;
  const insertPos = uploadIdx + '/upload/'.length;
  return url.slice(0, insertPos) + transform + '/' + url.slice(insertPos);
}

/**
 * Devuelve la URL con transformaciones aplicadas si el host es Cloudinary.
 * Para AWS S3/CloudFront: no se modifica la URL (documentar uso de Lambda@Edge o variantes WebP en el CDN).
 */
export function applyImageTransform(
  url: string | null | undefined,
  params: ImageTransformParams | undefined,
): string | null {
  if (!url?.trim()) return url ?? null;
  if (!params || (params.width == null && params.height == null && params.format == null)) {
    return url;
  }
  if (isCloudinaryUrl(url)) {
    return transformCloudinaryUrl(url, params);
  }
  return url;
}
