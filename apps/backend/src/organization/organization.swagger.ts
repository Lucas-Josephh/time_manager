import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  ApiConflictError,
  ApiNotFoundError,
  ApiResourceId,
  ApiServerError,
  ApiSuccessResponse,
  ApiValidationError,
  ApiWriteErrors,
} from '../common/swagger/api-response.decorator';
import { OrganizationDetailsDto } from './dto/organization.dto';

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
Session requise. Le contrôle du périmètre de management n’est pas encore implémenté.

### Champs
- **\`name\`** : obligatoire.
- **Parent, description et responsable** : optionnels.

### Résultat
Sans parent, l’organisation créée est une **racine**.`,
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
Session requise. Le contrôle du périmètre de management n’est pas encore implémenté.

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

export function ApiOrganizationFindOne() {
  return applyDecorators(
    ApiOperation({
      summary: 'Consulter une organisation',
      description: `### Accès
Session requise. Le contrôle du périmètre de management n’est pas encore implémenté.

### Résultat
Retourne les champs de l’organisation sans développer les relations.`,
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
Session requise. Le contrôle du périmètre de management n’est pas encore implémenté.

### Champs
- Les champs omis sont conservés.
- \`null\` retire la description, le parent ou le responsable.
- \`null\` est interdit pour le nom.

### Conflits
- **Cycle** : refusé en validation avec le code de champ \`organization_cycle\` (**400**), puis contrôlé à nouveau dans la transaction (**409** si nécessaire).
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
Session requise. Le contrôle du périmètre de management n’est pas encore implémenté.

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
