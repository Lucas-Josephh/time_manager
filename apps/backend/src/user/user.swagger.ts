import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiConflictError,
  ApiErrorResponse,
  ApiNotFoundError,
  ApiResourceId,
  ApiServerError,
  ApiUnauthorizedError,
  ApiValidationError,
  ApiWriteErrors,
} from '../common/swagger/api-response.decorator';

export function ApiUserController() {
  return applyDecorators(
    ApiTags('Users'),
    ApiServerError(),
    ApiUnauthorizedError(),
    ApiErrorResponse(
      HttpStatus.FORBIDDEN,
      ['forbidden', 'password_change_required'],
      'Administrateur requis. Le mot de passe temporaire doit avoir été changé.',
    ),
  );
}
export function ApiUserCreate() {
  return applyDecorators(
    ApiOperation({
      summary: 'Créer un utilisateur',
      description: `### Accès
Session requise. Réservé aux **administrateurs** (\`isAdmin: true\`). Le mot de passe temporaire de l’administrateur connecté doit avoir été changé.

### Champs
- **\`firstname\` et \`lastname\`** : obligatoires, non vides après suppression des espaces en début et fin, 255 caractères maximum chacun.
- **\`email\`** : obligatoire, valide et unique ; espaces en début et fin supprimés et conversion en minuscules.
- **\`password\`** : mot de passe temporaire obligatoire, de 12 à 128 caractères, avec majuscule, minuscule, chiffre et caractère spécial. Les espaces ne sont pas supprimés.
- **\`phone\`** : optionnel, numéro valide au format international ; \`null\` laisse le téléphone vide.
- **\`isAdmin\`** : optionnel, \`false\` par défaut ; \`null\` interdit.
- **\`name\`** : calculé à partir du prénom et du nom ; ne doit pas être envoyé.

### Équipe initiale
- **\`teamId\`** : optionnel, identifiant d’une équipe existante ; \`null\` interdit.
- Si fourni, l’utilisateur rejoint cette équipe et son organisation dès la création.
- Sinon, l’utilisateur est créé sans équipe ni organisation.
- Les changements ultérieurs d’appartenance passent par les routes Team. \`organizationId\` ne peut pas être fourni directement.

### Résultat
Retourne **201**, \`user_created\` et le profil dans \`data\`, sans mot de passe ni données de session.
Le profil, les identifiants de connexion et l’affectation initiale sont créés **dans une seule transaction**. Aucune session n’est ouverte pour le nouvel utilisateur.
Le champ \`mustChangePassword\` est fixé à \`true\` : l’utilisateur doit changer son mot de passe avant d’accéder aux routes protégées.

### Erreurs
- **400** \`validation_failed\` : erreurs dans \`data.errors\`, notamment \`already_exists\` sur \`email\`, \`reference_not_found\` sur \`teamId\` ou \`password_requirements_not_met\` sur \`password\`.
- Les champs non prévus par le DTO sont refusés avec \`validation_unknown_field\`.
- **409** : conflit de contrainte ou modification concurrente ; aucune création partielle.`,
    }),
    ApiWriteErrors(
      ['already_exists', 'reference_conflict', 'concurrent_modification'],
      'Conflit de contrainte ou modification concurrente ; réessayer après vérification des données.',
    ),
  );
}
export function ApiUserList() {
  return applyDecorators(
    ApiOperation({
      summary: 'Lister les utilisateurs',
      description: `### Accès
Session requise. Réservé aux **administrateurs** ayant changé leur mot de passe temporaire. La liste porte sur tous les utilisateurs.

### Filtres
- **\`email\`**, **\`firstname\`**, **\`lastname\`** : recherche partielle, sans distinction de casse.
- Les espaces en début et fin sont supprimés ; un filtre vide est refusé.
- Les filtres fournis se cumulent (condition **ET**).

### Pagination
- **\`page\`** : entier supérieur ou égal à 1 ; défaut **1**.
- **\`limit\`** : entier entre 1 et 100 ; défaut **10**.
- Tri par **date de création décroissante**, puis par **identifiant croissant**.

### Résultat
Retourne \`users_listed\`, avec les profils dans \`data.items\` et la pagination dans \`data.meta\` (\`total\`, \`page\`, \`limit\`, \`totalPages\`).
\`total\` compte les utilisateurs correspondant aux filtres, avant pagination. Sans résultat, \`items\` est vide et \`totalPages\` vaut 0. Une page dépassant la dernière page retourne une liste vide.`,
    }),
    ApiValidationError(),
  );
}
export function ApiUserDetail() {
  return applyDecorators(
    ApiOperation({
      summary: 'Consulter un utilisateur',
      description: `### Accès
Session requise. Réservé aux **administrateurs** ayant changé leur mot de passe temporaire.

### Résultat
Retourne le profil de l’utilisateur dans \`data\`, avec ses champs \`firstname\`, \`lastname\` et \`name\`, ses coordonnées, ses indicateurs et ses identifiants d’appartenance.
Les relations équipe et organisation ne sont pas développées. Aucun mot de passe, compte de connexion ou jeton de session n’est exposé.
Un identifiant inexistant renvoie **404** \`not_found\`.`,
    }),
    ApiResourceId('user-id'),
    ApiNotFoundError('not_found'),
  );
}
export function ApiUserUpdate() {
  return applyDecorators(
    ApiOperation({
      summary: 'Modifier un utilisateur',
      description: `### Accès
Session requise. Réservé aux **administrateurs** ayant changé leur mot de passe temporaire.

### Champs
- Seuls les champs fournis sont modifiés : les champs omis sont conservés.
- **\`firstname\` et \`lastname\`** : non vides après nettoyage, 255 caractères maximum ; modifier l’un des deux recalcule \`name\` avec la partie conservée.
- **\`email\`** : adresse valide et unique, nettoyée et convertie en minuscules. L’adresse actuelle de cet utilisateur est autorisée. Fournir ce champ remet l’indicateur de vérification de l’email à \`false\`, même si l’adresse est inchangée.
- **\`phone: null\`** : efface le téléphone ; sinon, un numéro international valide est attendu.
- **\`isAdmin\`** : accorde ou retire le rôle administrateur.
- \`null\` est interdit pour \`firstname\`, \`lastname\`, \`email\` et \`isAdmin\`.

### Champs exclus
\`name\`, \`password\`, \`mustChangePassword\`, \`teamId\`, \`organizationId\` et \`image\` ne sont pas modifiables par cette route.
Les appartenances se gèrent depuis Team. Les changements de mot de passe et les modifications du profil natif passent par Better Auth, avec son propre contrat.

### Résultat et erreurs
Retourne \`user_updated\` et le profil après modification dans \`data\`.
- **400** \`validation_failed\` : erreurs par champ dans \`data.errors\`, notamment \`already_exists\` sur \`email\` ou \`validation_unknown_field\` pour un champ exclu.
- **404** \`not_found\` : utilisateur inexistant.
- **409** : conflit de contrainte ou modification concurrente.`,
    }),
    ApiResourceId('user-id'),
    ApiNotFoundError('not_found'),
    ApiWriteErrors(
      ['already_exists', 'reference_conflict', 'concurrent_modification'],
      'Conflit de contrainte ou modification concurrente ; réessayer après vérification des données.',
    ),
  );
}
export function ApiUserDelete() {
  return applyDecorators(
    ApiOperation({
      summary: 'Supprimer un utilisateur',
      description: `### Accès
Session requise. Réservé aux **administrateurs** ayant changé leur mot de passe temporaire.

### Effets
- Supprime le profil, ses comptes de connexion et ses sessions.
- Les équipes et organisations dirigées sont conservées ; leur responsable devient \`null\`.
- L’équipe et l’organisation auxquelles l’utilisateur appartient sont conservées.

### Résultat
La suppression est effectuée avant la réponse **200**. Retourne \`user_deleted\` et le profil supprimé dans \`data\`.
Un identifiant inexistant renvoie **404** \`not_found\`.`,
    }),
    ApiResourceId('user-id'),
    ApiNotFoundError('not_found'),
    ApiConflictError(),
  );
}
