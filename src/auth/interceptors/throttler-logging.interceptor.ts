import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Interceptor temporal para verificar que el Throttler está evaluando las peticiones.
 * Logea IP y ruta; puede eliminarse cuando se confirme el rate limiting.
 */
@Injectable()
export class ThrottlerLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest<{ ip?: string; url?: string; route?: { path?: string } }>();
    const ip = req.ip ?? (req as unknown as { connection?: { remoteAddress?: string } }).connection?.remoteAddress ?? 'unknown';
    const handlerName = context.getHandler()?.name ?? 'unknown';
    const routePath = req.route?.path ?? req.url ?? 'unknown';

    console.log('[Throttler] Evaluando petición | IP:', ip, '| Ruta:', routePath, '| Handler:', handlerName);

    return next.handle().pipe(
      tap(() => {
        // Petición pasó el Throttler y el handler
      }),
    );
  }
}
