import { applyDecorators, HttpStatus } from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiConflictError,
  ApiResourceId,
  ApiNotFoundError,
  ApiServerError,
  ApiSuccessResponse,
  ApiWriteErrors,
  ApiValidationError,
} from '../common/swagger/api-response.decorator';
import {
  PartialTeamDto,
  TeamDto,
  TeamDetailsDto,
  TeamWithRelationsDto,
} from './dto/team.dto';

export function ApiTeamController() {
  return applyDecorators(
    ApiTags('Team'),
    ApiServerError(),
  );
}

export function ApiTeamCreate() {
  return applyDecorators(
    ApiOperation({
      summary: 'Créer une équipe',
      description: `### Accès
Session requise. Le contrôle du périmètre de management n’est pas encore implémenté.

### Champs
- **Nom** : doit être unique.
- **Organisation** : doit exister.
- **Responsable** : optionnel.`,
    }),
    ApiBody({ type: TeamDto }),
    ApiSuccessResponse({
      type: TeamDetailsDto,
      status: 201,
      message: 'team_created',
    }),
    ApiWriteErrors(),
    ApiConflictError(),
  );
}

export function ApiTeamReplace() {
  return applyDecorators(
    ApiOperation({
      summary: 'Mettre à jour une équipe',
      description: `### Accès
Session requise. Le contrôle du périmètre de management n’est pas encore implémenté.

### Champs
- **Nom et organisation** : requis.
- Le nom actuel de cette équipe est autorisé.
- Responsable omis : conservé ; \`null\` : retiré.`,
    }),
    ApiResourceId('team-administration'),
    ApiBody({ type: TeamDto }),
    ApiSuccessResponse({
      type: TeamDetailsDto,
      status: 200,
      message: 'team_updated',
    }),
    ApiWriteErrors(),
    ApiNotFoundError('not_found'),
    ApiConflictError(),
  );
}

export function ApiTeamUpdate() {
  return applyDecorators(
    ApiOperation({
      summary: 'Modifier partiellement une équipe',
      description: `### Accès
Session requise. Le contrôle du périmètre de management n’est pas encore implémenté.

### Champs
- Seuls les champs fournis sont modifiés : omettre les champs inchangés.
- Le nom actuel de cette équipe est autorisé.
- \`null\` peut retirer le responsable.`,
    }),
    ApiResourceId('team-administration'),
    ApiBody({ type: PartialTeamDto }),
    ApiSuccessResponse({
      type: TeamDetailsDto,
      status: 200,
      message: 'team_partially_updated',
    }),
    ApiWriteErrors(),
    ApiNotFoundError('not_found'),
    ApiConflictError(),
  );
}

export function ApiTeamDelete() {
  return applyDecorators(
    ApiOperation({
      summary: 'Supprimer une équipe',
      description: `### Accès
Session requise. Le contrôle du périmètre de management n’est pas encore implémenté.

### Conditions
Réaffecter les membres avant la suppression.

### Résultat
La suppression est exécutée **avant** l’envoi de la réponse **202**.`,
    }),
    ApiResourceId('team-administration'),
    ApiSuccessResponse({
      type: TeamDetailsDto,
      status: 202,
      message: 'team_deleted',
    }),
    ApiNotFoundError('not_found'),
    ApiConflictError(),
  );
}

export function ApiTeamFindAll() {
  return applyDecorators(
    ApiOperation({
      summary: 'Lister les équipes',
      description: `### Accès
Session requise. Le contrôle du périmètre de management n’est pas encore implémenté.

### Résultat
- Tri par **nom croissant**.
- Organisation, responsable et membres inclus.`,
    }),
    ApiSuccessResponse({
      type: TeamWithRelationsDto,
      status: HttpStatus.OK,
      message: 'team_listed',
      isArray: true,
    }),
    ApiValidationError(),
  );
}

export function ApiTeamFindOne() {
  return applyDecorators(
    ApiOperation({
      summary: 'Consulter une équipe',
      description: `### Accès
Session requise. Le contrôle du périmètre de management n’est pas encore implémenté.

### Résultat
- Organisation, responsable et membres inclus.
- Une équipe inexistante renvoie **404**.`,
    }),
    ApiResourceId('team-administration'),
    ApiSuccessResponse({ type: TeamWithRelationsDto, status: HttpStatus.OK }),
    ApiNotFoundError('not_found'),
  );
}
