/**
 * Acciones registradas en el Audit Log del módulo landing-admin.
 * Cada acción corresponde a un POST, PATCH o DELETE del panel admin.
 */
export const AUDIT_ACTIONS = {
  UPDATE_CONFIG: 'UPDATE_CONFIG',
  CREATE_BARBER: 'CREATE_BARBER',
  UPDATE_BARBER: 'UPDATE_BARBER',
  DELETE_BARBER: 'DELETE_BARBER',
  CREATE_SERVICE: 'CREATE_SERVICE',
  UPDATE_SERVICE: 'UPDATE_SERVICE',
  DELETE_SERVICE: 'DELETE_SERVICE',
  CREATE_GALLERY_ITEM: 'CREATE_GALLERY_ITEM',
  DELETE_GALLERY_ITEM: 'DELETE_GALLERY_ITEM',
} as const;

export type AuditActionType = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/**
 * Entidades afectadas por las acciones (nombre del modelo Prisma).
 */
export const AUDIT_ENTITIES = {
  LandingConfig: 'LandingConfig',
  Barber: 'Barber',
  Service: 'Service',
  GalleryItem: 'GalleryItem',
} as const;

export type AuditEntityType = (typeof AUDIT_ENTITIES)[keyof typeof AUDIT_ENTITIES];
