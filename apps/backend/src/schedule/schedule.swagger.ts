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

const weeklyScheduleRules = `- Les clés \`MONDAY\` à \`SUNDAY\` sont toutes obligatoires : lundi à dimanche.
- Chaque jour contient un tableau de créneaux ; un tableau vide représente un jour non travaillé.
- Chaque créneau contient \`startTime\` et \`endTime\`, au format H:mm ou HH:mm : par exemple \`9:00\` ou \`09:00\`, entre 0:00 et 23:59.
- Chaque créneau reste sur une seule journée : endTime doit être strictement après startTime.
- Les créneaux passant minuit sont refusés (exemple 22:00 → 06:00).
- Les chevauchements dans une journée sont refusés. Des créneaux adjacents sont acceptés.
- Les horaires sont locaux au fuseau IANA timezone du planning (Europe/Paris par défaut).`;

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
Session requise. Création réservée aux administrateurs et aux responsables d’équipe ou d’organisation.

### Champs
- \`name\` : chaîne non vide après suppression des espaces aux extrémités, 255 caractères maximum. Le nom n’est pas soumis à une règle d’unicité.
- \`weeklySchedule\` : semaine complète obligatoire.
- \`timezone\` : fuseau IANA, par défaut Europe/Paris.
- Le créateur est déduit de la session ; aucun identifiant de créateur ne doit être envoyé dans le body.

### Semaine
${weeklyScheduleRules}

### Résultat
Le planning, ses jours et ses créneaux sont créés atomiquement, sans affectation utilisateur.
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
- \`createdBy\` : identifiant exact du créateur ; espaces aux extrémités supprimés.
- Les filtres se cumulent et s’appliquent également au total. Les chaînes vides sont refusées.

### Pagination et résultat
- \`page\` : défaut 1, minimum 1.
- \`limit\` : défaut 10, entre 1 et 100.
- Réponse dans \`data.items\` et \`data.meta\` : total, page, limit, totalPages.
- Tri par date de création décroissante, puis identifiant croissant.
- Les jours et créneaux sont inclus directement, ainsi que le créateur résumé et sourceWorkScheduleId.
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

Retourne le planning avec ses jours, ses créneaux, son origine et son créateur résumé.
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
Session requise. Réservé aux administrateurs et aux responsables d’équipe ou d’organisation.

### Nouveau planning indépendant
Cette route conserve le planning source et crée un nouveau planning avec un nouvel identifiant.
Le champ sourceWorkScheduleId référence le planning source.
Les champs name, timezone et weeklySchedule sont optionnels ; les valeurs omises sont copiées.
Même une modification du nom ou une requête vide crée un nouveau planning.
Les identifiants des jours et créneaux sont nouveaux. Aucune affectation utilisateur n’est modifiée.

### Semaine
${weeklyScheduleRules}

### Résultat et erreurs
La réponse contient le nouveau planning avec ses jours, créneaux et créateur résumé.
Un planning source inexistant produit 404 not_found.
Un conflit concurrent peut produire 409 concurrent_modification. Un nouvel essai peut créer une copie supplémentaire si la première requête a déjà réussi.`,
    }),
    ApiResourceId('aea08ebd-ada9-4e1a-a7fb-2ca836160882'),
    ApiWriteErrors(
      ['already_exists', 'reference_conflict', 'concurrent_modification'],
      'Contrainte de base ou modification concurrente ; vérifier les données avant de réessayer.',
    ),
    ApiNotFoundError('not_found'),
  );
}

export function ApiScheduleTree() {
  return applyDecorators(
    ApiOperation({
      summary: 'Arborescence des plannings',
      description:
        'Retourne les racines et tous leurs descendants dans children, sans pagination.',
    }),
  );
}

export function ApiScheduleSubtree() {
  return applyDecorators(
    ApiOperation({
      summary: 'Sous-arborescence d’un planning',
      description:
        'Retourne un tableau contenant le planning demandé et tous ses descendants. Planning absent : 404.',
    }),
    ApiResourceId('schedule-morning'),
    ApiNotFoundError('not_found'),
  );
}
