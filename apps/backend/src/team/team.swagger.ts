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
import { AvailableTeamUserDto } from './dto/available-team-user.dto';
import {
  PartialSetTeamDto,
  SetTeamDto,
  TeamDetailsDto,
  TeamWithRelationsDto,
  TeamListDto,
} from './dto/team.dto';

const memberRules = `- **Administrateur** : peut ajouter ou transférer tout utilisateur, y compris sans organisation ou déjà dans une autre équipe.
- **Manager d’organisation** : peut ajouter ou transférer les utilisateurs de son organisation et de ses descendantes entre les équipes de ce même périmètre. Il ne peut pas retirer un utilisateur à une équipe hors de son périmètre.
- **Responsable d’équipe** : peut ajouter à sa propre équipe uniquement des utilisateurs sans équipe, rattachés à l’organisation de l’équipe ou à ses descendantes.
- Les utilisateurs déjà membres peuvent être conservés, même si leur organisation diffère de celle de l’équipe.
- Une affectation ne modifie **jamais** l’organisation de l’utilisateur. Si un responsable est transféré, son ancien rôle de responsable est retiré.
- Le responsable choisi est automatiquement membre. Les affectations et transferts sont atomiques.
- Un membre inexistant ou non autorisé provoque **409** \`team_members_unavailable\`, avec \`data.unavailableMembers\` et le motif \`not_found\`, \`already_in_team\` ou \`outside_organization\`.`;

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

export function ApiTeamReplace() {
  return applyDecorators(
    ApiOperation({
      summary: 'Mettre à jour une équipe',
      description: `### Accès
Session requise. Réservé aux administrateurs, au responsable actuel de cette équipe et aux managers de son organisation ou d’un de ses ancêtres. Un changement d’organisation exige aussi ces droits sur la destination. Les utilisateurs déjà membres conservent leur organisation et leur appartenance lors du déplacement de l’équipe.

### Champs
- **Nom et organisation** : requis.
- Le nom actuel de cette équipe est autorisé.
- Responsable omis : conservé ; \`null\` : retiré.

### Membres
${memberRules}
- \`memberIds\` fourni : remplace les membres.
- \`memberIds: []\` avec un responsable conservé ou défini : seul ce responsable reste membre.
- \`memberIds: []\` et \`managerId: null\` dans la même requête : retire le responsable et tous les membres ; l\'équipe devient vide.
- \`memberIds\` omis : conserve les membres actuels et ajoute automatiquement le nouveau responsable si défini.
- Pour \`PUT\`, les champs \`name\` et \`organizationId\` restent requis, y compris pour vider l\'équipe.`,
    }),
    ApiResourceId('team-administration'),
    ApiBody({ type: SetTeamDto }),
    ApiSuccessResponse({
      type: TeamWithRelationsDto,
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
Session requise. Réservé aux administrateurs, au responsable actuel de cette équipe et aux managers de son organisation ou d’un de ses ancêtres. Un changement d’organisation exige aussi ces droits sur la destination. Les utilisateurs déjà membres conservent leur organisation et leur appartenance lors du déplacement de l’équipe.

### Champs
- Seuls les champs fournis sont modifiés : omettre les champs inchangés.
- Le nom actuel de cette équipe est autorisé.
- \`null\` peut retirer le responsable.

### Membres
${memberRules}
- \`memberIds\` fourni : remplace les membres.
- \`memberIds: []\` avec un responsable conservé ou défini : seul ce responsable reste membre.
- \`memberIds: []\` et \`managerId: null\` dans la même requête : retire le responsable et tous les membres ; l\'équipe devient vide.
- \`memberIds\` omis : conserve les membres actuels et ajoute automatiquement le nouveau responsable si défini.
- Pour \`PUT\`, les champs \`name\` et \`organizationId\` restent requis, y compris pour vider l\'équipe.`,
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
Session requise. Réservé aux administrateurs, au responsable actuel de cette équipe et aux managers de son organisation ou d’un de ses ancêtres.

### Conditions
Réaffecter les membres avant la suppression.

### Résultat
La suppression est exécutée **avant** l\'envoi de la réponse **202**.`,
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
Session requise. Le contrôle du périmètre de management n\'est pas encore implémenté.

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
      summary: 'Lister les utilisateurs pouvant rejoindre l’équipe',
      description: `### Accès
Administrateur, manager de l’organisation de cette équipe ou de l’un de ses ancêtres, ou responsable actuel de cette équipe.

### Périmètre
- **Administrateur** : utilisateurs de toute organisation ou sans organisation, même déjà membres d’une autre équipe.
- **Manager d’organisation** : utilisateurs rattachés à son périmètre, sans équipe ou dans une équipe du même périmètre.
- **Responsable d’équipe** : utilisateurs sans équipe, rattachés à l’organisation de l’équipe ou à ses descendantes.
Les membres actuels de cette équipe sont exclus.

### Résultat
Tri par **nom**, puis **prénom**, puis **identifiant**. Sans pagination. Les mêmes règles s’appliquent à l’affectation effective.`,
    }),
    ApiResourceId('team-administration'),
    ApiSuccessResponse({
      type: AvailableTeamUserDto,
      isArray: true,
      message: 'team_available_users_listed',
    }),
    ApiErrorResponse(401, 'unauthorized', 'Session absente ou expirée.'),
    ApiErrorResponse(
      403,
      'forbidden',
      'Administrateur, manager de cette organisation ou de l’un de ses ancêtres, ou responsable de cette équipe requis.',
    ),
    ApiValidationError(),
    ApiNotFoundError('not_found'),
  );
}

export function ApiTeamFindOne() {
  return applyDecorators(
    ApiOperation({
      summary: 'Consulter une équipe',
      description: `### Accès
Session requise. Le contrôle du périmètre de management n\'est pas encore implémenté.

### Résultat
- Organisation, responsable et membres inclus.
- Une équipe inexistante renvoie **404**.`,
    }),
    ApiResourceId('team-administration'),
    ApiSuccessResponse({ type: TeamWithRelationsDto, status: HttpStatus.OK }),
    ApiNotFoundError('not_found'),
  );
}
