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
import { OrganizationDetailsDto, OrganizationTreeDto } from './dto/organization.dto';

export const organizationDescriptions = {
  tree: `### Accès
- **Administrateur** : accès à toutes les racines.
- **Manager** : accès uniquement aux organisations dirigées via \`Organization.managerId\` et à leurs descendants, sans doublons.

Le rattachement d\'un utilisateur à une organisation et le management d\'équipe ne donnent aucun droit d\'accès.

### Filtres
- **\`managerId\`** : sélectionne les organisations du responsable indiqué et conserve leurs ancêtres autorisés.
- **\`name\`** : recherche partielle, sans distinction de casse. Conserve les correspondances et leurs ancêtres autorisés.
- **\`parentId\`** : retourne l\'organisation ciblée et tous ses descendants. Une organisation inexistante ou inaccessible renvoie **404**.

### Résultat
- Tri par **nom**, puis par **identifiant**, à chaque niveau.
- Sans pagination ni relations développées.`,

  subtree: `Retourne l\'organisation ciblée et tous ses descendants dans un tableau contenant **une seule racine**.

### Accès
- **Administrateur** : accès autorisé.
- **Manager** : doit diriger l\'organisation ciblée ou l\'un de ses ancêtres via \`Organization.managerId\`.

Le rattachement d\'un utilisateur à une organisation et le management d\'équipe ne donnent aucun droit d\'accès.

### Filtres
- **\`managerId\`** : sélectionne les organisations du responsable indiqué et conserve leurs ancêtres dans ce sous-arbre.
- **\`name\`** : recherche partielle, sans distinction de casse. Conserve les correspondances et leurs ancêtres dans ce sous-arbre.

### Résultat
- Tri par **nom**, puis par **identifiant**.
- Sans pagination ni relations développées.`,
} as const;

export function ApiOrganizationController() {
  return applyDecorators(
    ApiTags('Organization'),
    ApiServerError(),
    ApiUnauthorizedResponse({ description: 'Session absente ou expirée.' }),
  );
}

export function ApiOrganizationCreate() {
  return applyDecorators(
    ApiOperation({
      summary: 'Créer une organisation',
      description: `### Accès
Session requise. Le contrôle du périmètre de management n\'est pas encore implémenté.

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
- Sans pagination ni filtrage par périmètre.`,
    }),
    ApiValidationError(),
    ApiSuccessResponse({ type: OrganizationDetailsDto, isArray: true }),
  );
}

export function ApiOrganizationTree() {
  return applyDecorators(
    ApiOperation({
      summary: 'Consulter l\'arborescence des organisations',
      description: organizationDescriptions.tree,
    }),
    ApiValidationError(),
    ApiErrorResponse(401, 'unauthorized', 'Session absente ou expirée.'),
    ApiErrorResponse(
      403,
      'forbidden',
      'Utilisateur ni administrateur ni responsable d\'organisation.',
    ),
    ApiNotFoundError('not_found', 'Organisation inexistante ou inaccessible.'),
    ApiSuccessResponse({ type: OrganizationTreeDto, isArray: true }),
  );
}

export function ApiOrganizationSubtree() {
  return applyDecorators(
    ApiOperation({
      summary: 'Consulter le sous-arbre d\'une organisation',
      description: organizationDescriptions.subtree,
    }),
    ApiResourceId('department-it'),
    ApiValidationError(),
    ApiErrorResponse(401, 'unauthorized', 'Session absente ou expirée.'),
    ApiErrorResponse(
      403,
      'forbidden',
      'Utilisateur ni administrateur ni responsable d\'organisation.',
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
Session requise. Le contrôle du périmètre de management n\'est pas encore implémenté.

### Champs
- Les champs omis sont conservés.
- \`null\` retire le parent ou le responsable.
- \`null\` est interdit pour le nom.

### Conflits
- **Cycle** : contrôlé dans la transaction et refusé avec le code de champ \`organization_cycle\` (**400**). Un conflit concurrent de transaction renvoie **409**.
- **Modification concurrente** : peut produire \`concurrent_modification\` (**409**). Réessayer la requête.`,
    }),
    ApiResourceId('department-it'),
    ApiNotFoundError('not_found'),
    ApiWriteErrors(),
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
Session requise. Le contrôle du périmètre de management n\'est pas encore implémenté.

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
