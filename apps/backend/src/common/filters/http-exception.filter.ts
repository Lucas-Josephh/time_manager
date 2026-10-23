import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ApiResponse } from '../types/api-response';
import { mapPrismaException } from './prisma-exception.mapper';

const DEFAULT_MESSAGES: Record<number, string> = {
  400: 'bad_request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  405: 'method_not_allowed',
  409: 'conflict',
  422: 'validation_failed',
  429: 'too_many_requests',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}
  catch(exception: unknown, host: ArgumentsHost): void {
    exception = mapPrismaException(exception);
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const isServerError = status >= 500;

    let message = isServerError
      ? 'internal_server_error'
      : (DEFAULT_MESSAGES[status] ?? 'request_failed');
    let data: Record<string, unknown> = {};

    if (exception instanceof HttpException && !isServerError) {
      const exceptionResponse = exception.getResponse();

      const customMessage =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : 'message' in exceptionResponse
            ? exceptionResponse.message
            : undefined;

      // Accepte uniquement un code comme "not_found".
      if (
        typeof customMessage === 'string' &&
        /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(customMessage)
      ) {
        message = customMessage;
        if (
          typeof exceptionResponse === 'object' &&
          'data' in exceptionResponse &&
          typeof exceptionResponse.data === 'object' &&
          exceptionResponse.data !== null &&
          !Array.isArray(exceptionResponse.data)
        ) {
          data = exceptionResponse.data as Record<string, unknown>;
        }
      }
    }

    if (isServerError) {
      if (exception instanceof Error) {
        this.logger.error(exception.message, exception.stack);
      } else {
        this.logger.error('Unknown server error');
      }
    }

    const body: ApiResponse = {
      success: false,
      message,
      data,
    };

    const response = host.switchToHttp().getResponse();
    const { httpAdapter } = this.adapterHost;

    if (!httpAdapter.isHeadersSent(response)) {
      httpAdapter.reply(response, body, status);
    }
  }
}
