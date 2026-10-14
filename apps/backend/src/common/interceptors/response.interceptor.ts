import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ApiResponse } from '../types/api-response';
import { Reflector } from '@nestjs/core';
import { map, Observable } from 'rxjs';
import { RESPONSE_MESSAGE_KEY } from '../decorator/response-message.decorator';
import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { RESPONSE_DTO_KEY } from '../serialization/serialize-response.decorator';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T | Record<string, never>>
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T | Record<string, never>>> {
    const message = this.reflector.getAllAndOverride<string>(
      RESPONSE_MESSAGE_KEY,
      [context.getHandler(), context.getClass()],
    );

    const responseDto = this.reflector.getAllAndOverride<ClassConstructor<object>>(
      RESPONSE_DTO_KEY,
      [context.getHandler(), context.getClass()],
    );

    return next.handle().pipe(
      map((data) => ({
        success: true,
        message: message ?? 'request_successful',
        data: (data == null
          ? {}
          : responseDto
            ? plainToInstance(responseDto, data, { exposeUnsetFields: false })
            : data) as T | Record<string, never>,
      })),
    );
  }
}
