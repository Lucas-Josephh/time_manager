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
export class ResponseInterceptor implements NestInterceptor<
  unknown,
  ApiResponse<unknown>
> {
  constructor(private readonly reflector: Reflector) {}

  /**
   * Intercepts the response and transforms it into a standardized API response format.
   *
   * @param context
   * @param next
   */
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<unknown>> {
    const targets = [context.getHandler(), context.getClass()];
    const message =
      this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE_KEY, targets) ??
      'request_successful';
    const responseDto = this.reflector.getAllAndOverride<
      ClassConstructor<object>
    >(RESPONSE_DTO_KEY, targets);

    return next.handle().pipe(
      map((data: unknown) => ({
        success: true,
        message,
        data: serializeDataFromDto(data, responseDto),
      })),
    );
  }
}

/**
 * Serializes the data from the DTO if provided, otherwise returns the data as is.
 *
 * @param data
 * @param dto
 */
function serializeDataFromDto(
  data: unknown,
  dto?: ClassConstructor<object>,
): unknown {
  if (data === null || data === undefined) return {};
  if (!dto) return data;
  return plainToInstance(dto, data, { exposeUnsetFields: false });
}
