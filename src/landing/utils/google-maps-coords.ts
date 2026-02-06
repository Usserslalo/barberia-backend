/**
 * Extrae latitud y longitud desde una URL de Google Maps o desde el HTML de un iframe.
 * Soporta patrones habituales: @lat,lng, q=lat,lng, query=lat,lng, ll=, embed src.
 * Las coordenadas se validan dentro de rangos reales (lat -90..90, lng -180..180).
 */

const LAT_MIN = -90;
const LAT_MAX = 90;
const LNG_MIN = -180;
const LNG_MAX = 180;

/** Patrones para extraer lat,lng de URLs de Google Maps (orden de prioridad). */
const COORD_PATTERNS = [
  // @19.4326,-99.1332,17z (común en share link)
  /@(-?\d+\.?\d*),(-?\d+\.?\d*)(?:,|\/|z|m)/,
  // ?q=19.4326,-99.1332 o &q=19.4326,-99.1332
  /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)(?:&|$)/,
  // query=19.4326,-99.1332 (search API)
  /[?&]query=(-?\d+\.?\d*),(-?\d+\.?\d*)(?:&|$)/,
  // ll=19.4326,-99.1332
  /[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)(?:&|$)/,
  // center=19.4326,-99.1332
  /[?&]center=(-?\d+\.?\d*),(-?\d+\.?\d*)(?:&|$)/,
  // pb= puede contener !3dLAT!4dLNG (embed)
  /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/,
  // fallback: dos números decimales seguidos (lat,lng) en contexto de mapa
  /(?:maps|place|search)[^]*?(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
];

function clampLat(lat: number): number {
  return Math.max(LAT_MIN, Math.min(LAT_MAX, lat));
}

function clampLng(lng: number): number {
  return Math.max(LNG_MIN, Math.min(LNG_MAX, lng));
}

function parseCoordsFromUrl(url: string): { latitude: number; longitude: number } | null {
  const decoded = tryDecodeUri(url);
  for (const re of COORD_PATTERNS) {
    const m = decoded.match(re);
    if (m) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const clampedLat = clampLat(lat);
        const clampedLng = clampLng(lng);
        if (clampedLat === lat && clampedLng === lng) {
          return { latitude: clampedLat, longitude: clampedLng };
        }
      }
    }
  }
  return null;
}

function tryDecodeUri(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Extrae la URL del atributo src de un iframe HTML.
 * Acepta fragmentos como: <iframe src="https://..."> o src='https://...'
 */
function extractIframeSrc(html: string): string | null {
  const srcMatch = html.match(/<iframe[^>]+src\s*=\s*["']([^"']+)["']/i);
  return srcMatch ? srcMatch[1].trim() : null;
}

export interface ParsedCoords {
  latitude: number;
  longitude: number;
}

/**
 * Parsea una URL de Google Maps o el HTML de un iframe de Google Maps y extrae
 * latitud y longitud cuando sea posible.
 *
 * - Si el input parece HTML (contiene '<'), se busca el atributo src del iframe y se parsea esa URL.
 * - Se prueban varios patrones habituales de Google Maps (@lat,lng, q=, query=, ll=, embed !3d!4d).
 * - Las coordenadas deben estar en rangos válidos: lat [-90, 90], lng [-180, 180].
 *
 * @param input URL de Google Maps (ej. https://www.google.com/maps?q=19.4326,-99.1332) o iframe completo
 * @returns { latitude, longitude } o null si no se pudieron extraer coordenadas válidas
 */
export function parseGoogleMapsCoords(input: string | null | undefined): ParsedCoords | null {
  if (input == null || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (trimmed === '') return null;

  let urlToParse = trimmed;
  if (trimmed.includes('<')) {
    const src = extractIframeSrc(trimmed);
    if (!src) return null;
    urlToParse = src;
  }

  if (!urlToParse.toLowerCase().includes('google') && !urlToParse.toLowerCase().includes('maps')) {
    return null;
  }

  return parseCoordsFromUrl(urlToParse);
}

/**
 * Genera la URL universal de Google Maps para abrir navegación (Waze/Google Maps) desde el móvil.
 * Formato: https://www.google.com/maps/search/?api=1&query={lat},{lng}
 */
export function buildNavigationUrl(latitude: number | null, longitude: number | null): string | null {
  if (
    latitude == null ||
    longitude == null ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }
  const lat = clampLat(latitude);
  const lng = clampLng(longitude);
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
