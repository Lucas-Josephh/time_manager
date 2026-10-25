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
Le responsable est automatiquement membre et doit respecter les mêmes règles d\'éligibilité. Il reste membre même si absent de \`memberIds\`. Retirer son rôle seul conserve son appartenance.
En cas de conflit : **409** \`team_members_unavailable\`, avec \`data.unavailableMembers\` (identifiant, prénom et nom si existant, et motif : \`already_in_team\`, \`outside_organization\` ou \`not_found\`).
Les membres doivent être **sans équipe** et appartenir à l\'organisation choisie ou à l\'une de ses descendantes.

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
Session requise. Réservé aux administrateurs, au responsable actuel de cette équipe et aux managers de son organisation ou d’un de ses ancêtres. Un changement d’organisation exige aussi ces droits sur la destination. Tous les membres conservés, y compris le responsable, doivent appartenir à la destination ou à ses descendantes ; sinon la requête est annulée avec 409 team_members_unavailable.

### Champs
- **Nom et organisation** : requis.
- Le nom actuel de cette équipe est autorisé.
- Responsable omis : conservé ; \`null\` : retiré.

### Membres
Le responsable est automatiquement membre et doit respecter les mêmes règles d\'éligibilité. Il reste membre même si absent de \`memberIds\`. Retirer son rôle seul conserve son appartenance.
En cas de conflit : **409** \`team_members_unavailable\`, avec \`data.unavailableMembers\` (identifiant, prénom et nom si existant, et motif : \`already_in_team\`, \`outside_organization\` ou \`not_found\`).
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
Session requise. Réservé aux administrateurs, au responsable actuel de cette équipe et aux managers de son organisation ou d’un de ses ancêtres. Un changement d’organisation exige aussi ces droits sur la destination. Tous les membres conservés, y compris le responsable, doivent appartenir à la destination ou à ses descendantes ; sinon la requête est annulée avec 409 team_members_unavailable.

### Champs
- Seuls les champs fournis sont modifiés : omettre les champs inchangés.
- Le nom actuel de cette équipe est autorisé.
- \`null\` peut retirer le responsable.

### Membres
Le responsable est automatiquement membre et doit respecter les mêmes règles d\'éligibilité. Il reste membre même si absent de \`memberIds\`. Retirer son rôle seul conserve son appartenance.
En cas de conflit : **409** \`team_members_unavailable\`, avec \`data.unavailableMembers\` (identifiant, prénom et nom si existant, et motif : \`already_in_team\`, \`outside_organization\` ou \`not_found\`).
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
      summary: 'Lister les utilisateurs sans équipe disponibles',
      description: `### Accès
Réservé au **responsable de cette équipe** et aux **administrateurs**.

### Périmètre
Retourne les utilisateurs **sans aucune équipe**, appartenant à l\'organisation de l\'équipe ou à l\'une de ses organisations descendantes.

### Résultat
- Tri par **nom**, puis **prénom**, puis **identifiant**.
- Sans pagination.`,
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
      'Responsable de cette équipe ou administrateur requis.',
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
