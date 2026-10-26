import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiConflictError,
  ApiErrorResponse,
  ApiResourceId,
  ApiNotFoundError,
  ApiServerError,
  ApiSuccessResponse,
  ApiWriteErrors,
  ApiValidationError,
} from '../common/swagger/api-response.decorator';
import { UserSummaryDto } from '../user/dto/user.dto';
import {
  PartialSetTeamDto,
  SetTeamDto,
  TeamDetailsDto,
  TeamWithRelationsDto,
  TeamListDto,
} from './dto/team.dto';

const memberRules = `- Un utilisateur appartient à une seule équipe au maximum et ne peut pas être membre de l’équipe qu’il manage.
- Les ajouts concernent les utilisateurs sans équipe dans les organisations gérées ou celles des équipes managées, descendants inclus. L’admin n’a pas cette restriction.
- Un transfert exige les droits de gestion des membres des deux équipes. À la création, l’équipe source est déduite automatiquement de chaque utilisateur de memberIds ; la route dédiée de transfert exige un teamId source explicite.
- Les appartenances et les responsabilités sont indépendantes. Aucun changement de membre ne modifie son organisation ou ses responsabilités.
- Les écritures sont atomiques. Les candidats indisponibles provoquent 409 team_members_unavailable.`;

export function ApiTeamController() {
  return applyDecorators(
    ApiTags('Team'),
    ApiServerError(),
    ApiErrorResponse(401, 'unauthorized', 'Session absente ou expirée.'),
    ApiErrorResponse(
      403,
      ['forbidden', 'password_change_required'],
      'Droits de gestion requis pour les écritures ; mot de passe temporaire à changer si nécessaire.',
    ),
  );
}

export function ApiTeamCreate() {
  return applyDecorators(
    ApiOperation({
      summary: 'Créer une équipe',
      description: `### Accès
Session requise. Réservé aux **administrateurs** et aux **managers de l’organisation choisie ou de l’une de ses organisations parentes**.

### Champs
- **Nom** : doit être unique.
- **Organisation** : doit exister.
- **Responsable** et **\`memberIds\`** : optionnels.

### Membres
${memberRules}

### Résultat
Les utilisateurs de \`memberIds\` déjà affectés à une équipe sont transférés automatiquement après vérification des droits sur leur équipe source.
La création et les affectations sont **atomiques**.`,
    }),
    ApiErrorResponse(401, 'unauthorized', 'Session absente ou expirée.'),
    ApiErrorResponse(
      403,
      'forbidden',
      'Administrateur ou manager de cette organisation ou d’une organisation parente requis.',
    ),
    ApiBody({ type: SetTeamDto }),
    ApiSuccessResponse({
      type: TeamWithRelationsDto,
      status: 201,
      message: 'team_created',
    }),
    ApiWriteErrors(),
    ApiConflictError(),
  );
}

export function ApiTeamUpdate() {
  return applyDecorators(
    ApiOperation({
      summary: 'Modifier partiellement une équipe',
      description: `### Accès
Session requise. Réservé aux administrateurs, au responsable actuel de cette équipe et aux managers de son organisation ou d’un de ses ancêtres. Un changement d’organisation exige aussi ces droits sur la destination. Les utilisateurs déjà membres conservent leur organisation et leur appartenance lors du déplacement de l’équipe.

### Champs
Seuls name et organizationId sont acceptés. Un déplacement exige les droits de gestion des organisations source et destination et conserve membres et manager.
Utiliser PATCH /team/:id/manager pour le responsable, POST /team/:id/members pour les ajouts, DELETE /team/:id/members/:userId pour les retraits, POST /team/:id/transfers pour les transferts.`,
    }),
    ApiResourceId('team-administration'),
    ApiBody({ type: PartialSetTeamDto }),
    ApiSuccessResponse({
      type: TeamWithRelationsDto,
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
Session requise. Réservé aux administrateurs et aux managers de son organisation ou d’un de ses ancêtres.

### Conditions
Réaffecter les membres avant la suppression.

### Résultat
La suppression est exécutée **avant** l\'envoi de la réponse **200**.`,
    }),
    ApiResourceId('team-administration'),
    ApiSuccessResponse({
      type: TeamDetailsDto,
      status: 200,
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
Session requise. Admin : toutes les équipes. Manager d’organisation : ses organisations et descendants. Responsable : ses équipes. Simple membre : accès refusé.

### Résultat
- Tri par **nom**, puis par **identifiant**, croissants.
- Pagination : \`page\` (défaut 1), \`limit\` (défaut 10, maximum 100).
- Résultats dans \`data.items\` ; \`data.meta\` contient total, page, limit et totalPages.
- Les filtres se cumulent et s’appliquent aussi au total.
- Organisation, responsable et membres inclus.`,
    }),
    ApiSuccessResponse({
      type: TeamListDto,
      status: HttpStatus.OK,
      message: 'team_listed',
    }),
    ApiValidationError(),
  );
}

export function ApiTeamFindAvailableUsers() {
  return applyDecorators(
    ApiOperation({
      summary: 'Lister les utilisateurs accessibles pour constituer une équipe',
      description: `usage=member|transfer|manager et teamId sont obligatoires. member : utilisateurs sans équipe dans le périmètre autorisé. transfer : membres des autres équipes accessibles. manager : tout utilisateur existant sauf les membres de la cible. Les droits sur la cible sont vérifiés.`,
    }),
    ApiSuccessResponse({
      type: UserSummaryDto,
      isArray: true,
      message: 'team_available_users_listed',
    }),
    ApiErrorResponse(401, 'unauthorized', 'Session absente ou expirée.'),
    ApiErrorResponse(403, 'forbidden', 'Aucun droit de gestion d’organisation ou d’équipe.'),
  );
}

export function ApiTeamFindOne() {
  return applyDecorators(
    ApiOperation({
      summary: 'Consulter une équipe',
      description: `### Accès
Session requise. Admin : toutes les équipes. Manager d’organisation : ses organisations et descendants. Responsable : ses équipes. Simple membre : accès refusé.

### Résultat
- Organisation, responsable et membres inclus.
- Une équipe inexistante renvoie **404**.`,
    }),
    ApiResourceId('team-administration'),
    ApiSuccessResponse({ type: TeamWithRelationsDto, status: HttpStatus.OK }),
    ApiNotFoundError('not_found'),
  );
}
