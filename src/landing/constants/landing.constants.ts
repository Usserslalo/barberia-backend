/**
 * Constantes del módulo Landing.
 * El ID del config principal coincide con el seed para consistencia.
 */
export const LANDING_CONFIG_ID = '11111111-1111-1111-1111-111111111111';

/**
 * URL de imagen por defecto cuando un barbero no tiene photoUrl.
 * Usado en GET /api/landing/barbers para que el wizard muestre foto igual que la sección "Nuestro equipo".
 */
export const PLACEHOLDER_BARBER_IMAGE =
  'https://images.placeholders.dev/?width=400&height=400&text=Barbero';
