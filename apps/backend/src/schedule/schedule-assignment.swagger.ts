import { fieldErrorsSchema } from '../common/swagger/field-errors.schema';
import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  ApiErrorResponse,
  ApiUnauthorizedError,
  ApiValidationError,
  ApiServerError,
  ApiResourceId,
} from '../common/swagger/api-response.decorator';

export function ApiScheduleAssignmentController() {
  return applyDecorators(
    ApiTags('Schedule assignments'),
    ApiUnauthorizedError(),
    ApiServerError(),
    ApiErrorResponse(
      HttpStatus.FORBIDDEN,
      [
        'schedule_assignment_forbidden',
        'retroactive_assignment_forbidden',
        'forbidden',
      ],
      'Droits insuffisants : data.errors est indexé par userIds[index] (écriture), userId (lecture) ou effectiveFrom (rétroactivité).',
      true,
    ),
    ApiErrorResponse(
      HttpStatus.NOT_FOUND,
      'not_found',
      'Planning ou utilisateur introuvable. Les utilisateurs manquants sont indiqués dans data.errors par leur index de requête.',
      true,
    ),
  );
}

export function ApiScheduleAssign() {
  return applyDecorators(
    ApiOperation({
      summary: 'Attribuer un planning à plusieurs utilisateurs',
      description:
        'Opération atomique. Administrateur, responsable d’équipe ou d’organisation (descendants inclus). Tous les utilisateurs doivent être autorisés. effectiveFrom omis : instant serveur. Rétroactivité : administrateur et confirmRetroactive=true. Une affectation future postérieure bloque toute la sélection. Le planning exact est conservé, sans propagation aux descendants.',
    }),
    ApiValidationError(),
    ApiErrorResponse(
      HttpStatus.BAD_REQUEST,
      [
        'validation_failed',
        'effective_from_requires_timezone',
        'invalid_effective_from',
        'retroactive_assignment_confirmation_required',
      ],
      'Date invalide ou confirmation manquante. data.errors utilise effectiveFrom ou confirmRetroactive.',
      true,
    ),
    ApiResponse({
      status: HttpStatus.CONFLICT,
      description:
        'Affectation ultérieure existante, même date déjà affectée ou modification concurrente. Relire avant de réessayer en cas de concurrence.',
      schema: {
        type: 'object',
        required: ['success', 'message', 'data'],
        properties: {
          success: { type: 'boolean', enum: [false] },
          message: {
            type: 'string',
            enum: [
              'later_schedule_assignment_exists',
              'already_exists',
              'reference_conflict',
              'concurrent_modification',
            ],
          },
          data: {
            type: 'object',
            properties: {
              errors: fieldErrorsSchema,
              conflictingAssignments: {
                type: 'array',
                description: 'Présent pour later_schedule_assignment_exists.',
                items: {
                  type: 'object',
                  required: ['userId', 'workScheduleId', 'effectiveFrom'],
                  properties: {
                    userId: { type: 'string' },
                    workScheduleId: { type: 'string' },
                    effectiveFrom: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    }),
    ApiResourceId('schedule-morning'),
  );
}

export function ApiScheduleAssignmentHistory() {
  return applyDecorators(
    ApiOperation({
      summary: 'Historique paginé des affectations',
      description:
        'Inclut les affectations futures, triées par prise d’effet décroissante. Accessible à soi-même, aux administrateurs et responsables du périmètre utilisateur.',
    }),
    ApiValidationError(),
    ApiParam({
      name: 'userId',
      required: true,
      type: String,
      description: 'Identifiant de l’utilisateur concerné.',
      example: 'user-1',
    }),
  );
}

export function ApiUserSchedule() {
  return applyDecorators(
    ApiOperation({
      summary: 'Planning applicable à un instant donné',
      description:
        'at : instant ISO avec offset ; maintenant par défaut. data.assignment contient le planning dans workSchedule, ou null si aucune affectation applicable. Mêmes droits que l’historique.',
    }),
    ApiValidationError(),
    ApiErrorResponse(
      HttpStatus.BAD_REQUEST,
      ['validation_failed', 'effective_from_requires_timezone', 'invalid_effective_from'],
      'Instant at invalide : data.errors.at.',
      true,
    ),
    ApiParam({
      name: 'userId',
      required: true,
      type: String,
      description: 'Identifiant de l’utilisateur concerné.',
      example: 'user-1',
    }),
  );
}
