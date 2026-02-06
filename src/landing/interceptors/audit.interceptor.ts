import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { LANDING_CONFIG_ID } from '../constants/landing.constants';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '../constants/audit.constants';
import type { AuditActionType, AuditEntityType } from '../constants/audit.constants';
import { LandingService } from '../services/landing.service';
import { AuditService } from '../services/audit.service';
import type { JwtValidatedUser } from '../../auth/strategies/jwt.strategy';

type RouteAuditMeta = {
  action: AuditActionType;
  entity: AuditEntityType;
  /** Para PATCH/DELETE: entityId viene de params (o config id). Para POST: de response. */
  entityIdFromParams: boolean;
};

const ROUTE_AUDIT_MAP: Record<string, RouteAuditMeta> = {
  updateConfig: {
    action: AUDIT_ACTIONS.UPDATE_CONFIG,
    entity: AUDIT_ENTITIES.LandingConfig,
    entityIdFromParams: true,
  },
  createBarber: {
    action: AUDIT_ACTIONS.CREATE_BARBER,
    entity: AUDIT_ENTITIES.Barber,
    entityIdFromParams: false,
  },
  updateBarber: {
    action: AUDIT_ACTIONS.UPDATE_BARBER,
    entity: AUDIT_ENTITIES.Barber,
    entityIdFromParams: true,
  },
  deactivateBarber: {
    action: AUDIT_ACTIONS.DELETE_BARBER,
    entity: AUDIT_ENTITIES.Barber,
    entityIdFromParams: true,
  },
  createService: {
    action: AUDIT_ACTIONS.CREATE_SERVICE,
    entity: AUDIT_ENTITIES.Service,
    entityIdFromParams: false,
  },
  updateService: {
    action: AUDIT_ACTIONS.UPDATE_SERVICE,
    entity: AUDIT_ENTITIES.Service,
    entityIdFromParams: true,
  },
  deactivateService: {
    action: AUDIT_ACTIONS.DELETE_SERVICE,
    entity: AUDIT_ENTITIES.Service,
    entityIdFromParams: true,
  },
  createGalleryItem: {
    action: AUDIT_ACTIONS.CREATE_GALLERY_ITEM,
    entity: AUDIT_ENTITIES.GalleryItem,
    entityIdFromParams: false,
  },
  deleteGalleryItem: {
    action: AUDIT_ACTIONS.DELETE_GALLERY_ITEM,
    entity: AUDIT_ENTITIES.GalleryItem,
    entityIdFromParams: true,
  },
};

/**
 * Interceptor que registra en el Audit Log las acciones POST, PATCH y DELETE del landing-admin.
 * Para PATCH/DELETE obtiene el estado anterior (oldData) antes de ejecutar el handler.
 * El guardado del log es asíncrono (fire-and-forget) para no retrasar la respuesta.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly landingService: LandingService,
    private readonly auditService: AuditService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<Request & { user?: JwtValidatedUser }>();
    const handlerName = context.getHandler().name as string;
    const meta = ROUTE_AUDIT_MAP[handlerName];

    if (!meta || !request.user) {
      return next.handle();
    }

    const { action, entity, entityIdFromParams } = meta;
    const method = request.method;

    if (method !== 'POST' && method !== 'PATCH' && method !== 'DELETE') {
      return next.handle();
    }

    let entityIdBefore: string | null = null;
    if (entityIdFromParams) {
      if (entity === AUDIT_ENTITIES.LandingConfig) {
        entityIdBefore = LANDING_CONFIG_ID;
      } else {
        const id = request.params?.id;
        entityIdBefore =
          typeof id === 'string' ? id : Array.isArray(id) ? (id[0] ?? null) : null;
      }
    }

    // Obtener oldData antes del handler (solo PATCH y DELETE)
    if ((method === 'PATCH' || method === 'DELETE') && entityIdBefore) {
      try {
        const oldData = await this.landingService.getOldDataForAudit(
          action,
          entityIdBefore,
        );
        (request as Request & { _auditOldData?: Record<string, unknown> | null })._auditOldData =
          oldData ?? null;
      } catch {
        (request as Request & { _auditOldData?: Record<string, unknown> | null })._auditOldData =
          null;
      }
    }
    (request as Request & { _auditEntityId?: string | null })._auditEntityId =
      entityIdBefore;
    (request as Request & { _auditAction?: AuditActionType })._auditAction = action;
    (request as Request & { _auditEntity?: AuditEntityType })._auditEntity = entity;

    return next.handle().pipe(
      tap((responseBody) => {
        const req = request as Request & {
          user?: JwtValidatedUser;
          _auditOldData?: Record<string, unknown> | null;
          _auditEntityId?: string | null;
          _auditAction?: AuditActionType;
          _auditEntity?: AuditEntityType;
        };
        const adminId = req.user?.userId;
        if (!adminId) return;

        const entityId =
          req._auditEntityId ??
          (responseBody && typeof responseBody === 'object' && 'id' in responseBody
            ? (responseBody as { id: string }).id
            : null);

        let newData: Record<string, unknown> | null = null;
        if (responseBody != null && typeof responseBody === 'object') {
          newData = responseBody as Record<string, unknown>;
        } else if (method === 'DELETE' && responseBody === undefined) {
          // DELETE gallery devuelve 204 sin body; indicamos borrado
          newData = { deleted: true };
        }

        this.auditService.logAsync({
          adminId,
          action: req._auditAction!,
          entity: req._auditEntity!,
          entityId,
          oldData: req._auditOldData ?? null,
          newData,
        });
      }),
    );
  }
}
