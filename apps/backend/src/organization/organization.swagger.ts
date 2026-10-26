import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  ApiConflictError,
  ApiErrorResponse,
  ApiNotFoundError,
  ApiResourceId,
  ApiServerError,
  ApiSuccessResponse,
  ApiValidationError,
  ApiWriteErrors,
} from '../common/swagger/api-response.decorator';
import {
  OrganizationDetailsDto,
  OrganizationListDto,
  OrganizationTreeDto,
} from './dto/organization.dto';

export const organizationDescriptions = {
  tree: `### Accès
- **Administrateur** : accès à toutes les racines.
- **Manager** : accès uniquement aux organisations dirigées via \`Organization.managerId\` et à leurs organisations enfants à tous les niveaux, sans doublons.

Le rattachement d\'un utilisateur à une organisation et le management d\'équipe ne donnent aucun droit d\'accès.

### Résultat
- Tri par **nom**, puis par **identifiant**, à chaque niveau.
- Sans filtres de query, pagination ni relations développées.`,

  subtree: `Retourne l\'organisation ciblée et toutes ses organisations enfants à tous les niveaux dans un tableau contenant **une seule racine**.

### Accès
- **Administrateur** : accès autorisé.
- **Manager** : doit diriger l\'organisation ciblée ou l\'un de ses ancêtres via \`Organization.managerId\`.

Le rattachement d\'un utilisateur à une organisation et le management d\'équipe ne donnent aucun droit d\'accès.

### Résultat
- Tri par **nom**, puis par **identifiant**.
- Sans filtres de query, pagination ni relations développées.`,
} as const;

export function ApiOrganizationController() {
  return applyDecorators(
    ApiTags('Organization'),
    ApiServerError(),
    ApiUnauthorizedResponse({ description: 'Session absente ou expirée.' }),
    ApiErrorResponse(
      403,
      ['forbidden', 'password_change_required'],
      'Droits de gestion insuffisants ou mot de passe temporaire à changer.',
    ),
  );
}

export function ApiOrganizationCreate() {
  return applyDecorators(
    ApiOperation({
      summary: 'Créer une organisation',
      description: `### Accès
Session requise. Administrateur ou manager du parent choisi ou de l’un de ses ancêtres. La création d’une racine est réservée aux administrateurs.

### Champs
- **\`name\`** : obligatoire.
- **Parent et responsable** : optionnels.

### Résultat
Sans parent, l\'organisation créée est une **racine**.`,
    }),
    ApiWriteErrors(),
    ApiSuccessResponse({
      type: OrganizationDetailsDto,
      status: 201,
      message: 'organization_created',
    }),
  );
}

export function ApiOrganizationFindAll() {
  return applyDecorators(
    ApiOperation({
      summary: 'Lister les organisations',
      description: `### Accès
Session requise. Le contrôle du périmètre de management n\'est pas encore implémenté.

### Filtres
- Nom.
- Parent direct.
- Responsable.

### Résultat
- Tri par **nom**, puis par **identifiant**.
- Pagination : \`page\` (défaut 1), \`limit\` (défaut 10, maximum 100).
- Résultats dans \`data.items\` ; \`data.meta\` contient total, page, limit et totalPages.
- Les filtres se cumulent et s’appliquent aussi au total. Sans filtrage par périmètre.`,
    }),
    ApiValidationError(),
    ApiSuccessResponse({ type: OrganizationListDto }),
  );
}

export function ApiOrganizationTree() {
  return applyDecorators(
    ApiOperation({
      summary: "Consulter l'arborescence des organisations",
      description: organizationDescriptions.tree,
    }),
    ApiErrorResponse(401, 'unauthorized', 'Session absente ou expirée.'),
    ApiErrorResponse(
      403,
      'forbidden',
      "Utilisateur ni administrateur ni responsable d'organisation.",
    ),
    ApiSuccessResponse({ type: OrganizationTreeDto, isArray: true }),
  );
}

export function ApiOrganizationSubtree() {
  return applyDecorators(
    ApiOperation({
      summary: "Consulter le sous-arbre d'une organisation",
      description: organizationDescriptions.subtree,
    }),
    ApiResourceId('department-it'),
    ApiErrorResponse(401, 'unauthorized', 'Session absente ou expirée.'),
    ApiErrorResponse(
      403,
      'forbidden',
      "Utilisateur ni administrateur ni responsable d'organisation.",
    ),
    ApiNotFoundError('not_found', 'Organisation inexistante ou inaccessible.'),
    ApiSuccessResponse({ type: OrganizationTreeDto, isArray: true }),
  );
}

export function ApiOrganizationFindOne() {
  return applyDecorators(
    ApiOperation({
      summary: 'Consulter une organisation',
      description: `### Accès
Session requise. Le contrôle du périmètre de management n\'est pas encore implémenté.

### Résultat
Retourne les champs de l\'organisation sans développer les relations.`,
    }),
    ApiResourceId('department-it'),
    ApiNotFoundError('not_found'),
    ApiSuccessResponse({ type: OrganizationDetailsDto }),
  );
}

export function ApiOrganizationUpdate() {
  return applyDecorators(
    ApiOperation({
      summary: 'Modifier une organisation',
      description: `### Accès
Session requise. Administrateur ou manager de cette organisation ou de l’un de ses ancêtres. Un changement de parent exige aussi les droits sur la destination ; transformer une organisation en racine est réservé aux administrateurs.

### Champs
- Les champs omis sont conservés.
- \`null\` retire le parent ou le responsable.
- \`null\` est interdit pour le nom.

### Conflits
Les appartenances aux équipes sont indépendantes de la hiérarchie : un déplacement conserve les équipes des utilisateurs, même si leur organisation sort du périmètre de leur équipe.
- **Cycle** : contrôlé dans la transaction et refusé avec le code de champ \`organization_cycle\` (**400**). Un conflit concurrent de transaction renvoie **409**.
- **Modification concurrente** : peut produire \`concurrent_modification\` (**409**). Réessayer la requête.`,
    }),
    ApiResourceId('department-it'),
    ApiNotFoundError('not_found'),
    ApiWriteErrors(),
    ApiErrorResponse(
      409,
      ['already_exists', 'reference_conflict', 'concurrent_modification'],
      'Conflit de contrainte ou modification concurrente.',
    ),
    ApiSuccessResponse({
      type: OrganizationDetailsDto,
      message: 'organization_updated',
    }),
  );
}

export function ApiOrganizationDelete() {
  return applyDecorators(
    ApiOperation({
      summary: 'Supprimer une organisation',
      description: `### Accès
Session requise. Administrateur ou manager de cette organisation ou de l’un de ses ancêtres.

### Conditions
La suppression est refusée si des équipes ou des organisations enfants existent.

### Résultat
Les utilisateurs directement rattachés sont **détachés et conservés**.`,
    }),
    ApiResourceId('department-it'),
    ApiNotFoundError('not_found'),
    ApiConflictError(),
    ApiSuccessResponse({
      type: OrganizationDetailsDto,
      message: 'organization_deleted',
    }),
  );
}
