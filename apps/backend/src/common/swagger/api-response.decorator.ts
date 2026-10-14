import { applyDecorators, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiParam, ApiResponse, getSchemaPath } from '@nestjs/swagger';

interface SuccessOptions {
  type: Type<unknown>;
  status?: number;
  message?: string;
  isArray?: boolean;
  allowEmpty?: boolean;
  description?: string;
}

export function ApiSuccessResponse({
  type, status = 200, message = 'request_successful',
  isArray = false, allowEmpty = false, description = 'Opération réussie.',
}: SuccessOptions) {
  const reference = { $ref: getSchemaPath(type) };
  const data = isArray
    ? { type: 'array' as const, items: reference }
    : allowEmpty
      ? { oneOf: [reference, { type: 'object' as const, additionalProperties: false }] }
      : reference;

  return applyDecorators(
    ApiExtraModels(type),
    ApiResponse({
      status,
      description,
      schema: {
        type: 'object',
        required: ['success', 'message', 'data'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          message: { type: 'string', enum: [message], example: message },
          data,
        },
      },
    }),
  );
}

export function ApiResourceId(example: string) {
  return ApiParam({
    name: 'id', required: true, type: String,
    description: 'Identifiant unique de la ressource ciblée.', example,
  });
}

export function ApiErrorResponse(status: number, message: string, description: string) {
  return ApiResponse({
    status,
    description,
    schema: {
      type: 'object',
      required: ['success', 'message', 'data'],
      properties: {
        success: { type: 'boolean', enum: [false] },
        message: { type: 'string', enum: [message] },
        data: { type: 'object', additionalProperties: false },
      },
      example: { success: false, message, data: {} },
    },
  });
}

export function ApiNotFoundError(message: string, description = 'La ressource ciblée est introuvable.') {
  return ApiErrorResponse(404, message, description);
}

export function ApiValidationError() {
  return ApiResponse({
    status: 400,
    description:
      'DTO invalide : already_exists, reference_not_found, is_required, need_string, max_length_exceeded ou validation_unknown_field. Une erreur est retenue par champ.',
    schema: {
      type: 'object',
      required: ['success', 'message', 'data'],
      properties: {
        success: { type: 'boolean', enum: [false] },
        message: { type: 'string', enum: ['validation_failed'] },
        data: {
          type: 'object',
          required: ['errors'],
          properties: {
            errors: {
              type: 'array',
              items: {
                type: 'object',
                required: ['field', 'messages'],
                properties: {
                  field: { type: 'string', example: 'name' },
                  messages: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['already_exists'],
                  },
                },
              },
            },
          },
        },
      },
      example: {
        success: false,
        message: 'validation_failed',
        data: { errors: [{ field: 'name', messages: ['already_exists'] }] },
      },
    },
  });
}

export function ApiWriteErrors() {
  return applyDecorators(ApiValidationError(), ApiConflictError());
}

export function ApiConflictError() {
  return ApiResponse({
    status: 409,
    description:
      'Contrainte de base : already_exists pour un doublon concurrent ; reference_conflict pour une référence invalide ou une ressource encore référencée.',
    schema: {
      type: 'object',
      required: ['success', 'message', 'data'],
      properties: {
        success: { type: 'boolean', enum: [false] },
        message: {
          type: 'string',
          enum: ['already_exists', 'reference_conflict'],
        },
        data: { type: 'object', additionalProperties: false },
      },
      example: { success: false, message: 'reference_conflict', data: {} },
    },
  });
}

export function ApiServerError() {
  return ApiErrorResponse(
    500,
    'internal_server_error',
    'Erreur inattendue ; détails journalisés uniquement côté serveur.',
  );
}
