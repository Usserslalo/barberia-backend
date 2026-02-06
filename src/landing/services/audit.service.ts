import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../constants/audit.constants';
import type { AuditActionType, AuditEntityType } from '../constants/audit.constants';

export interface AuditLogEntry {
  adminId: string;
  action: AuditActionType;
  entity: AuditEntityType;
  entityId: string | null;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
}

/**
 * Servicio de auditoría para el módulo landing-admin.
 * Los logs se persisten de forma asíncrona (fire-and-forget) para no retrasar la respuesta al usuario.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra una entrada en el audit log sin bloquear la respuesta.
   * Se ejecuta en segundo plano; los errores se ignoran para no afectar al flujo principal.
   */
  logAsync(entry: AuditLogEntry): void {
    setImmediate(() => {
      this.prisma.auditLog
        .create({
          data: {
            adminId: entry.adminId,
            action: entry.action,
            entity: entry.entity,
            entityId: entry.entityId,
            oldData:
              (entry.oldData != null ? entry.oldData : Prisma.JsonNull) as Prisma.InputJsonValue,
            newData:
              (entry.newData != null ? entry.newData : Prisma.JsonNull) as Prisma.InputJsonValue,
          },
        })
        .catch(() => {
          // No re-lanzar: el log es secundario; no debe romper la petición
        });
    });
  }

  /**
   * Lista entradas del audit log con paginación y filtros opcionales por entity y adminId.
   */
  async findMany(options: {
    page?: number;
    limit?: number;
    entity?: string;
    adminId?: string;
  }): Promise<{ items: Awaited<ReturnType<PrismaService['auditLog']['findMany']>>; total: number }> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: { entity?: string; adminId?: string } = {};
    if (options.entity?.trim()) where.entity = options.entity.trim();
    if (options.adminId?.trim()) where.adminId = options.adminId.trim();

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          admin: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total };
  }
}
