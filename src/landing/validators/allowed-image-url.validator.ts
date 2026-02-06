import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

const ALLOWED_IMAGE_DOMAINS_ENV = 'ALLOWED_IMAGE_DOMAINS';
const BASE_URL_ENV = 'BASE_URL';

/**
 * Obtiene la lista de hosts permitidos para URLs de imágenes.
 * - Host del BASE_URL (nuestro servidor).
 * - Dominios en ALLOWED_IMAGE_DOMAINS (separados por coma).
 * - Si no hay ninguno configurado, se permiten localhost y 127.0.0.1 para desarrollo.
 */
export function getAllowedImageHosts(): string[] {
  const hosts: string[] = [];
  const baseUrl = process.env[BASE_URL_ENV];
  if (baseUrl) {
    try {
      const u = new URL(baseUrl);
      if (u.hostname) hosts.push(u.hostname.toLowerCase());
    } catch {
      // ignore invalid BASE_URL
    }
  }
  const domains = process.env[ALLOWED_IMAGE_DOMAINS_ENV];
  if (domains) {
    domains
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean)
      .forEach((d) => {
        if (!hosts.includes(d)) hosts.push(d);
      });
  }
  if (hosts.length === 0) {
    hosts.push('localhost', '127.0.0.1');
  }
  return hosts;
}

/**
 * Valida que la URL pertenezca a nuestro servidor (BASE_URL) o a dominios permitidos (ALLOWED_IMAGE_DOMAINS).
 * Evita inyección de enlaces externos en campos de imagen.
 */
function allowedImageUrlValidate(value: unknown, _args: ValidationArguments): boolean {
  if (value == null || value === '') return true;
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    const allowed = getAllowedImageHosts();
    return allowed.includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function IsAllowedImageUrl(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isAllowedImageUrl',
      target: object.constructor,
      propertyName,
      options: validationOptions ?? {
        message:
          'La URL de la imagen debe pertenecer al servidor o a un dominio permitido (BASE_URL / ALLOWED_IMAGE_DOMAINS).',
      },
      validator: {
        validate: allowedImageUrlValidate,
      },
    });
  };
}
