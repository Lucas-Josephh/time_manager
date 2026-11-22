import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  ApiConflictError,
  ApiErrorResponse,
  ApiNotFoundError,
  ApiServerError,
  ApiUnauthorizedError,
} from '../common/swagger/api-response.decorator';

export function ApiClockController() {
  return applyDecorators(
    ApiTags('Clock'),
    ApiUnauthorizedError(),
    ApiErrorResponse(
      HttpStatus.FORBIDDEN,
      'password_change_required',
      'Changement de mot de passe requis.',
    ),
    ApiServerError(),
  );
}

export function ApiClockCurrent() {
  return ApiOperation({
    summary: 'Consulter son pointage',
    description:
      'Renvoie la session ouverte, la dernière session terminée ou une session nulle si aucun pointage n’a été enregistré.',
  });
}

export function ApiClockStart() {
  return applyDecorators(
    ApiOperation({
      summary: 'Pointer son arrivée',
      description:
        'Ouvre une session à l’heure du serveur avec le planning en vigueur.',
    }),
    ApiConflictError(
      ['work_schedule_required', 'work_session_already_open'],
      'Aucun planning en vigueur ou une session est déjà ouverte.',
    ),
  );
}

export function ApiClockStop() {
  return applyDecorators(
    ApiOperation({
      summary: 'Pointer son départ',
      description:
        'Clôture une session du compte connecté. Un nouvel appel conserve l’heure de départ initiale.',
    }),
    ApiParam({ name: 'id', schema: { type: 'string', format: 'uuid' } }),
    ApiErrorResponse(HttpStatus.BAD_REQUEST, 'bad_request', 'UUID invalide.'),
    ApiNotFoundError('work_session_not_found'),
  );
}
