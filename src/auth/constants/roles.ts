import { Role } from '@prisma/client';

/**
 * Constantes de roles para RBAC.
 * Usar siempre estas constantes en lugar de strings literales.
 */
export const ROLES = {
  ADMIN: 'ADMIN' as Role,
  USER: 'USER' as Role,
} as const;

export type RoleType = Role;
