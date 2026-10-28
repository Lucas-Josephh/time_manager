import { applyDecorators, HttpCode, HttpStatus } from '@nestjs/common';
import { SerializeResponse } from '../serialization/serialize-response.decorator';
import { ApiSuccessResponse, type SuccessOptions } from '../swagger/api-response.decorator';
import { ResponseMessage } from './response-message.decorator';

/** Defines the runtime response and its OpenAPI documentation together. */
export function ApiResult({
  status = HttpStatus.OK,
  message = 'request_successful',
  ...options
}: SuccessOptions = {}) {
  return applyDecorators(
    HttpCode(status),
    ResponseMessage(message),
    ...(options.type ? [SerializeResponse(options.type)] : []),
    ApiSuccessResponse({ ...options, status, message }),
  );
}
