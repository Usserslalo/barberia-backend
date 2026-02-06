import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Request, Response } from 'express';

/**
 * Formato estándar de todas las respuestas de error del sistema.
 */
export interface HttpExceptionResponseBody {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string | string[];
  code?: string; // Ej: 'TEMPORARILY_LOCKED' para que el front distinga el tipo de error
  errorResponse?: unknown;
}

/**
 * Filtro global de excepciones.
 * Estandariza las respuestas de error: statusCode, timestamp, path, message.
 * errorResponse (objeto original) solo se incluye cuando NODE_ENV !== 'production'.
 * Los errores de validación de class-validator se normalizan a un mensaje legible (string o array).
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const path = request.url;
    const timestamp = new Date().toISOString();

    let statusCode: number;
    let message: string | string[];
    let code: string | undefined;
    let errorResponse: unknown;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      if (exception instanceof ThrottlerException) {
        code = 'THROTTLED';
      }
      const rawResponse = exception.getResponse();

      if (typeof rawResponse === 'string') {
        message = rawResponse;
        errorResponse = { message: rawResponse };
      } else {
        const obj = rawResponse as Record<string, unknown>;
        const msg = obj.message;

        if (Array.isArray(msg)) {
          message = msg.length === 1 ? msg[0] : msg;
        } else if (typeof msg === 'string') {
          message = msg;
        } else {
          message = 'Error de validación';
        }

        if (typeof obj.code === 'string') {
          code = obj.code;
        }
        errorResponse = obj;
      }

      this.logger.warn(
        `HttpException ${statusCode} | path=${path} | message=${JSON.stringify(message)}`,
      );
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Ha ocurrido un error interno. Por favor, inténtelo de nuevo más tarde.';
      errorResponse = exception;

      this.logger.error(
        `Error inesperado | path=${path}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: HttpExceptionResponseBody = {
      statusCode,
      timestamp,
      path,
      message,
    };
    if (code !== undefined) {
      body.code = code;
    }
    if (process.env.NODE_ENV !== 'production') {
      body.errorResponse = errorResponse;
    }

    response.status(statusCode).json(body);
  }
}
