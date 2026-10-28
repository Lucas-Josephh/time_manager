import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiErrorResponse,
  ApiNotFoundError,
  ApiResourceId,
  ApiServerError,
  ApiUnauthorizedError,
  ApiValidationError,
  ApiWriteErrors,
} from '../common/swagger/api-response.decorator';

const weeklyScheduleRules = `- Les clés \`1\` à \`7\` sont toutes obligatoires : lundi à dimanche.
- Chaque jour contient un tableau de créneaux ; un tableau vide représente un jour non travaillé.
- Chaque créneau contient \`startTime\` et \`endTime\`, au format H:mm ou HH:mm : par exemple \`9:00\` ou \`09:00\`, entre 0:00 et 23:59.
- L’ordre début/fin et les chevauchements entre créneaux ne sont pas contrôlés actuellement.`;

export function ApiScheduleController() {
  return applyDecorators(
    ApiTags('Schedule'),
    ApiUnauthorizedError(),
    ApiErrorResponse(
      HttpStatus.FORBIDDEN,
      'password_change_required',
      'Le mot de passe temporaire doit être changé avant d’accéder aux plannings.',
    ),
    ApiServerError(),
  );
}

export function ApiScheduleCreate() {
  return applyDecorators(
    ApiOperation({
      summary: 'Créer un planning de travail',
      description: `### Accès
Session requise. Aucun contrôle supplémentaire de rôle ou de périmètre organisationnel n’est actuellement appliqué.

### Champs
- \`name\` : chaîne non vide après suppression des espaces aux extrémités, 255 caractères maximum. Le nom n’est pas soumis à une règle d’unicité.
- \`weeklySchedule\` : semaine complète obligatoire.
- Le créateur est déduit de la session ; aucun identifiant de créateur ne doit être envoyé dans le body.

### Semaine
${weeklyScheduleRules}

### Résultat
Le planning et sa première version, numérotée 1, sont créés atomiquement.
La réponse contient les jours, les créneaux et le créateur du planning limité à id, firstname et lastname.
Le message de succès est \`request_successful\`.`,
    }),
    ApiWriteErrors(),
  );
}

export function ApiScheduleFindAll() {
  return applyDecorators(
    ApiOperation({
      summary: 'Lister les plannings de travail',
      description: `### Accès
Session requise. Tous les plannings sont accessibles, sans restriction au créateur ou à une organisation.

### Filtres
- \`name\` : recherche partielle, sans distinction de casse ; espaces aux extrémités supprimés.
- \`createdByUserId\` : identifiant exact du créateur ; espaces aux extrémités supprimés.
- Les filtres se cumulent et s’appliquent également au total. Les chaînes vides sont refusées.

### Pagination et résultat
- \`page\` : défaut 1, minimum 1.
- \`limit\` : défaut 10, entre 1 et 100.
- Réponse dans \`data.items\` et \`data.meta\` : total, page, limit, totalPages.
- Tri par date de création décroissante, puis identifiant croissant.
- Toutes les versions sont incluses, par numéro décroissant, avec leurs jours et créneaux. Le créateur du planning est inclus sous forme résumée.
- Une page sans résultat contient un tableau vide ; totalPages vaut 0 lorsqu’aucun planning ne correspond aux filtres.`,
    }),
    ApiValidationError(),
  );
}

export function ApiScheduleFindOne() {
  return applyDecorators(
    ApiOperation({
      summary: 'Consulter un planning de travail',
      description: `Session requise. Aucun contrôle de rôle, de créateur ou de périmètre organisationnel n’est actuellement appliqué.

Retourne le planning et toutes ses versions, triées par date de création décroissante, avec leurs jours et créneaux.
Le créateur n’est pas chargé par cette opération.
Un identifiant inexistant retourne actuellement une réponse de succès avec \`data: {}\`, sans erreur 404.`,
    }),
    ApiResourceId('aea08ebd-ada9-4e1a-a7fb-2ca836160882'),
  );
}

export function ApiScheduleUpdate() {
  return applyDecorators(
    ApiOperation({
      summary: 'Modifier un planning de travail',
      description: `### Accès
Session requise. Aucun contrôle supplémentaire de rôle, de créateur ou de périmètre organisationnel n’est actuellement appliqué.

### Modification partielle
- \`name\` et \`weeklySchedule\` sont optionnels ; les champs omis sont conservés.
- Modifier uniquement le nom ne crée pas de version.
- Si \`weeklySchedule\` est fourni, les sept jours sont obligatoires : il définit une nouvelle version complète, et non une modification jour par jour.
- Chaque semaine fournie crée une version, même lorsque son contenu est identique à la précédente. Son numéro suit celui de la dernière version ; son créateur est déduit de la session.
- Les valeurs \`null\` de premier niveau sont actuellement ignorées, comme les champs omis.

### Semaine
${weeklyScheduleRules}

### Résultat et erreurs
La modification est atomique et conserve les versions précédentes. La réponse inclut toutes les versions par numéro décroissant, leurs jours et leurs créneaux. Le créateur du planning n’est pas chargé.
Un planning inexistant produit \`404 not_found\`. Un conflit concurrent peut produire \`409 concurrent_modification\` ; la requête peut être réessayée.`,
    }),
    ApiResourceId('aea08ebd-ada9-4e1a-a7fb-2ca836160882'),
    ApiWriteErrors(
      ['already_exists', 'reference_conflict', 'concurrent_modification'],
      'Contrainte de base ou modification concurrente ; vérifier les données avant de réessayer.',
    ),
    ApiNotFoundError('not_found'),
  );
}
