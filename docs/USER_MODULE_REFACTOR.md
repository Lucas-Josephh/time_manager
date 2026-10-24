# Notes de refactorisation du module User

Date : 24 octobre 2026.

## Objectif

Aligner User sur les conventions d’Organization et Team après le merge : contrôleurs légers, DTO validés, sérialisation explicite, erreurs communes et règles d’accès cohérentes.

## Accès

- Toutes les routes `/api/users` utilisent `AuthGuard` puis `AdminGuard`.
- Une session absente ou expirée produit `401 unauthorized`.
- `AdminGuard` relit `isAdmin` en base : un utilisateur non administrateur reçoit `403 forbidden`, y compris si son ancien état de session indiquait encore un rôle administrateur.
- `AuthGuard` refuse l’accès avec `403 password_change_required` si le mot de passe doit être changé.
- Toutes les routes Team exigent désormais une session, afin que les routes auparavant publiques ne contournent pas cette obligation. Les écritures Team exigent les droits de gestion sur l’organisation concernée.

## Affectations

- `teamId` est accepté uniquement dans le DTO de création User et reste interdit dans le PATCH. `organizationId` et `mustChangePassword` ne sont pas des champs éditables de ces DTO.
- Les champs non éditables envoyés à User sont refusés par la validation commune, au lieu d’être ignorés.
- À la création, `teamId` est optionnel. L’organisation du nouvel utilisateur est déduite de l’équipe choisie ; le service Team vérifie l’équipe et résout son organisation avant la création. Les deux identifiants sont enregistrés dans l’insertion initiale du profil, dans la même transaction que les identifiants d’authentification. Une erreur annule toute la création.
- Les changements ultérieurs d’appartenance passent par Team et ses contrôles d’éligibilité, de périmètre et de responsable.
- `teamId`, `organizationId`, `isAdmin` et `mustChangePassword` sont des champs additionnels Better Auth. Leur entrée est autorisée uniquement sur l’instance serveur de provisionnement (`provisionUsers: true`). L’instance publique conserve `input: false` sur ces champs et interdit les inscriptions publiques.
- La commande CLI de création ne propose plus `--team-id`.

Exemple de création avec équipe initiale :

```json
{
  "firstname": "Alice",
  "lastname": "Martin",
  "email": "alice.martin@example.com",
  "password": "Temporary123!",
  "teamId": "team-support"
}
```

Sans `teamId`, le compte est créé sans équipe et sans organisation.

## Service et contrôleur

- Méthodes CRUD harmonisées : `create`, `findAll`, `findOne`, `update`, `delete`.
- Suppression du faux filtre `username`, de la méthode PUT inutilisée, des blocs commentés et du catch transformant toutes les erreurs PATCH en 404.
- `@ResourceExists('user')` contrôle l’existence des ressources ciblées, comme dans les autres modules. `requireResource` conserve également un contrat explicite dans `findOne`.
- Lors d’un PATCH, l’unicité de l’email est vérifiée avec `requireUnique`, en excluant l’utilisateur courant. La création vérifie l’email dans `CreateUserDto` avec `@Unique('user', 'email')`, dont le validateur est enregistré dans Nest. La contrainte unique en base reste active. Les conflits Prisma restent traités par le filtre commun.
- La création utilise bien `provisionUsers: true`, avec création des identifiants et enregistrement du profil dans une même transaction Prisma.
- Tous les champs sont transmis à `signUpEmail` et insérés directement : prénom, nom, email, téléphone si renseigné, rôle administrateur, indicateur de changement de mot de passe et, si une équipe est fournie, identifiants de l’équipe et de son organisation. Aucun `update` ou `updateMany` ne complète la création ; une lecture finale récupère le profil Prisma pour la réponse. Tous les champs acceptés par le PATCH sont enregistrés : prénom, nom, email, téléphone et rôle administrateur.
- L’email est nettoyé et mis en minuscules. Une écriture de l’email remet `emailVerified` à false.
- Les noms vides et les valeurs nulles sur les champs non nullables sont refusés. `phone: null` reste autorisé pour effacer le téléphone.

## Réponses et documentation API

- `@SerializeResponse(UserDetailsDto)` filtre les réponses User, y compris les éléments de liste via un DTO dédié.
- `UserSummaryDto` reste utilisé pour les relations Team et n’expose que l’identifiant, le prénom et le nom.
- Le DTO détaillé utilise les champs réellement présents dans Prisma : retrait de `departmentId` et `managerId`, ajout de `organizationId`, de l’indicateur de mot de passe et des dates.
- La documentation Swagger est regroupée dans `user.swagger.ts` et réutilise les décorateurs communs de succès et d’erreur.
- Les messages de succès deviennent `user_created`, `users_listed`, `user_updated` et `user_deleted`.

### Liste paginée

`GET /api/users` accepte `page` (entier ≥ 1), `limit` (entier de 1 à 100), `email`, `firstname` et `lastname`.

Les filtres textuels sont partiels et insensibles à la casse. Le tri utilise la date de création décroissante puis l’identifiant pour départager les résultats.

La réponse est désormais :

```json
{
  "success": true,
  "message": "users_listed",
  "data": {
    "items": [],
    "meta": { "total": 0, "page": 1, "limit": 10, "totalPages": 0 }
  }
}
```

Les clients doivent remplacer l’ancienne lecture `data.data` par `data.items`, et remplacer le filtre `username` par les filtres existants.

## Changement de mot de passe obligatoire

- `mustChangePassword` est rétabli dans le schéma Prisma et exposé dans la session Better Auth.
- Les nouveaux comptes provisionnés par Better Auth ont cet indicateur à true par défaut. La création depuis User l’enregistre explicitement.
- L’utilisateur peut se connecter, consulter sa session, se déconnecter et utiliser les endpoints natifs de mot de passe. Les routes métier protégées restent bloquées tant que l’indicateur est à true.
- Le client peut utiliser `POST /api/auth/change-password` avec `currentPassword` et `newPassword`, puis relire `/api/auth/get-session`.
- Les exigences de complexité s’appliquent aussi à `/change-password`. Réutiliser exactement le mot de passe actuel est refusé.
- Un changement réussi remet l’indicateur à false ; un échec conserve l’obligation. Le callback de réinitialisation réussie du mot de passe remet également l’indicateur à false.
- Aucun écran frontend de changement de mot de passe n’a été ajouté dans cette intervention backend.

### Migration

La migration qui supprimait `mustChangePassword` est retirée. Le schéma réutilise la colonne créée par la migration existante `20261015090723_addmust_change_password`, avec sa valeur par défaut SQL false conservée. L’obligation des nouveaux comptes est imposée par le provisionnement Better Auth et explicitement par User. Aucune nouvelle migration SQL n’est nécessaire.

Les valeurs des utilisateurs existants sont conservées : les comptes existants à false ne sont pas rétroactivement forcés à changer leur mot de passe. Aucune migration n’a été exécutée sur la base pendant l’intervention. Si la migration de suppression avait déjà été appliquée dans un autre environnement, il faudra réconcilier cet historique avant déploiement.

## Nettoyage et régression Organization

- Imports `src/...` remplacés par des imports relatifs dans User, compatibles avec Jest et le code compilé.
- Retrait de la deuxième installation du ValidationPipe : `APP_PIPE` et la configuration commune restent la source de validation.
- Retrait de la deuxième initialisation Swagger et du conteneur de validation dans `main.ts` : `configureApp` centralise cette configuration.
- Correction de l’arborescence Organization : le périmètre d’un manager part de toutes les organisations dirigées, même sous une racine. La racine demandée est ensuite vérifiée dans le périmètre accessible.
- Correction du mock de la suite Organization : il respecte la combinaison des critères Prisma, plutôt que d’ignorer certains critères.

## Vérifications

- Tests HTTP User : session, rôle administrateur, mot de passe obligatoire, sérialisation, pagination, filtres, champs interdits, PATCH, 404 et conflits Prisma.
- Tests de provisionnement : configuration autorisant la création, transaction, résolution de l’équipe avant insertion et persistance de tous les champs à l’insertion, sans mise à jour complémentaire. Un test utilise réellement Better Auth avec son adaptateur mémoire et observe le hook de création.
- Tests Better Auth avec adaptateur mémoire : échecs de changement, réussite, nouveaux identifiants et protection des champs sensibles via le profil natif.
- Dernière suite complète backend : 45 suites et 386 tests réussis. Frontend : 4 tests réussis. TypeScript des deux applications et lint vérifiés ; build backend vérifié.
- Ces tests utilisent des mocks Prisma et un adaptateur mémoire Better Auth. La migration et le provisionnement transactionnel n’ont pas été exécutés contre une base PostgreSQL réelle.

## Décorateur de gestion des équipes

- `@CanManageTeams()` et `CanManageTeamsGuard` remplacent les noms limités à la création. La règle métier commune est `TeamService.assertCanManageTeams` : administrateur ou manager de l’organisation concernée ou d’un ancêtre.
- Sur POST, le décorateur contrôle l’organisation demandée dans le body.
- Sur PUT, PATCH et DELETE, `@CanManageTeams({ teamId: 'id' })` retrouve l’équipe et contrôle son organisation actuelle. Une équipe inexistante produit 404 avant la validation du body.
- Un déplacement via PUT/PATCH exige également les droits de gestion sur l’organisation de destination. Le body ne permet pas de contourner le contrôle du périmètre actuel.
- Le responsable actuel d’une équipe peut modifier ou supprimer cette équipe. Cette autorisation repose sur le managerId lu en base, jamais sur celui du body. Elle ne donne pas le droit de créer d’autres équipes et ne remplace pas les droits requis dans une organisation de destination.
- `@CanManageTeams` compose `UseGuards(AuthGuard, CanManageTeamsGuard)` : authentification puis permissions. `AuthGuard` est retiré de la classe et appliqué explicitement aux trois routes de lecture. Chaque route authentifie une seule fois, avant tout contrôle de ressource ou de permissions. Le guard métier utilise la session sans répéter sa vérification. Les identifiants invalides du body restent rejetés par le DTO ; les chaînes valides sont nettoyées comme dans le DTO.
- Les routes de lecture conservent leurs règles existantes.

## Lisibilité de l’arborescence Organization

Le choix des organisations de départ utilise maintenant trois branches explicites : organisations dirigées pour un manager, organisation ciblée pour un administrateur avec une racine demandée, sinon organisations sans parent pour un administrateur. Le filtre et le tri sont typés avec Prisma. Les variables intermédiaires `whereAdmin`, `whereManager` et `seeds` sont remplacées par un filtre unique et `startingOrganizations`. Les commentaires qui paraphrasaient le code sont retirés ; le contrôle d’accès et le parcours des descendants sont conservés.

## Permissions des organisations

- Ajout de `OrganizationService.assertCanManageOrganizations` et du décorateur `@CanManageOrganizations`, qui compose l’authentification puis le guard de permissions.
- Création d’une organisation : administrateur ou manager du parent choisi ou d’un ancêtre ; les nouvelles racines sont réservées aux administrateurs.
- Modification et suppression : administrateur ou manager de l’organisation ciblée ou d’un ancêtre. Le manager demandé dans le body ne donne aucun droit.
- Un changement de parent exige également les droits sur la destination. Transformer une organisation en racine est réservé aux administrateurs. Conserver un parent inchangé ne demande pas de droits supplémentaires sur ce parent.
- Les routes de lecture gardent leur contrôle de session existant. L’authentification s’exécute une seule fois avant les contrôles de ressource et de permissions.
- Les identifiants de parent et de manager sont nettoyés dans le DTO. Les commentaires du nouveau guard suivent le style de celui des équipes : session, metadata, organisation ciblée, suppression, validation et destination.

## Éligibilité lors d’un déplacement d’équipe

- Le service relit l’organisation actuelle dans la transaction pour détecter un déplacement effectif.
- Si les membres sont conservés, tous sont revérifiés dans la destination ou ses descendants, y compris le responsable conservé ou nouvellement désigné.
- Si `memberIds` est fourni, seule la liste finale est vérifiée, avec le responsable automatiquement inclus. Les membres retirés par cette liste ne bloquent pas le déplacement.
- Une incompatibilité produit `409 team_members_unavailable` avec le détail des utilisateurs concernés ; la modification de l’équipe et les affectations sont annulées ensemble.
- Les requêtes fournissant une organisation utilisent une transaction Serializable. Les conflits concurrents restent exposés via le filtre Prisma commun.

## Unicité des emails à la création

- La validation normale des doublons est portée par le DTO et utilise le format commun `validation_failed`, champ `email`, code `already_exists`.
- La contrainte unique PostgreSQL protège aussi contre deux requêtes simultanées ayant passé la validation.
- Avec `autoSignIn: false`, Better Auth peut renvoyer un utilisateur fictif en cas de doublon. Une absence de profil réel après cet appel produit maintenant une erreur d’unicité, et non une 404.
- Si Better Auth enveloppe un conflit concurrent dans une erreur de création, la vérification de l’email est faite après le rollback, hors de la transaction échouée. Les erreurs sans doublon confirmé continuent à remonter normalement.

## Nettoyage des chaînes dans les DTO

- Ajout du décorateur commun `@Trim()`, construit avec `class-transformer`, pour remplacer les transformations répétées dans les DTO Organization, Team et User, y compris les paramètres de route des utilisateurs disponibles.
- `@Trim({ each: true })` nettoie les éléments textuels de `memberIds` avant les contrôles de tableau, d’unicité et de format.
- Les valeurs non textuelles, `null` et `undefined` sont conservées pour les validateurs. Le décorateur ne convertit pas les types.
- Le champ email combine `@Trim()` et sa transformation en minuscules. Les mots de passe ne sont pas nettoyés.
- L’extraction initiale conserve le comportement des champs existants. Les filtres d’identifiants restants ont ensuite été alignés avec `@Trim()`, comme détaillé ci-dessous.

## Déplacement d’une organisation et appartenances aux équipes

- Avant un changement effectif de parent, le service compare les anciens et les nouveaux ancêtres dans la même transaction Serializable.
- Seules les équipes rattachées aux ancêtres perdus peuvent perdre leur périmètre sur les utilisateurs de la branche déplacée. Le service vérifie ces utilisateurs, y compris ceux des sous-organisations.
- En cas d’incompatibilité, la réponse est `409 organization_move_invalidates_team_memberships`, avec `data.affectedMembers` (identifiant, prénom, nom et équipe). Le changement de parent n’est pas enregistré.
- Les équipes internes à la branche déplacée et celles d’un ancêtre commun restent autorisées. Les utilisateurs sans équipe et les incohérences préexistantes hors de la branche déplacée ne bloquent pas le déplacement.
- Les transactions d’affectation des membres dans Team et de création d’un utilisateur sont également Serializable pour coordonner leurs lectures et écritures avec les déplacements. Les conflits concurrents peuvent demander de réessayer la requête.

## Parcours commun et filtres d’identifiants

- `getOrganizationAncestors` centralise la remontée des parents avec protection contre les cycles et les parents manquants. Organization et Team conservent leurs règles de permissions dans leurs services.
- `getOrganizationDescendantIds` centralise le parcours des descendants, sans doublons. Il est utilisé pour les utilisateurs disponibles, l’éligibilité des membres et le contrôle des déplacements d’organisations.
- Le contrôle spécifique des cycles de rattachement reste dans `checkOrganizationParent`. L’assemblage des objets de l’arborescence conserve son parcours dédié.
- Les filtres `QueryOrganizationDto.managerId`, `QuerySetTeamDto.organizationId`, `managerId` et `memberId` utilisent désormais `@Trim()`. Une valeur constituée uniquement d’espaces est rejetée par `@IsNotEmpty()`.

## Validation du profil natif Better Auth

- Le hook avant `/api/auth/update-user` appelle `validateUserProfile` avant de transmettre les données à Better Auth.
- `UpdateProfileDto` dérive des champs `firstname`, `lastname` et `phone` de `UserProfileDto` via `PickType` et `PartialType`. Les règles de nettoyage, de noms non vides, de longueur maximale et de téléphone sont ainsi partagées avec `/api/users`.
- Le hook valide directement `firstname` et `lastname`. Lorsque l’un change, il calcule le nom d’affichage `name` à partir des deux propriétés distinctes. Les erreurs portent sur les noms des champs reçus, sans conversion.
- Les champs autorisés sont définis uniquement par `UpdateProfileDto` : `firstname`, `lastname` et `phone`. `name` est calculé par le serveur et `image` est refusé car il ne figure plus dans ce DTO. Les champs inconnus et protégés (`isAdmin`, `mustChangePassword`, `teamId`, `organizationId`, `email`, `id`, etc.) sont explicitement refusés.
- Les champs omis sont conservés. `phone: null` efface le téléphone ; `firstname: null` et `lastname: null` sont refusés.
- Better Auth conserve la gestion de la session et de l’identité modifiée. Un utilisateur non administrateur peut modifier uniquement son propre profil.
- Ces routes contournant les pipes et filtres Nest, le hook utilise `APIError` avec le statut 400, `code: VALIDATION_FAILED`, `message: validation_failed` et `data.errors`.
- Le formatage des erreurs de validation est partagé avec Nest via `formatValidationErrors`. Un téléphone invalide produit désormais `invalid_phone_number` dans les deux parcours.
- Les tests passent par les endpoints HTTP natifs avec Better Auth et son adaptateur mémoire : normalisation, champs partiels, null, valeurs invalides, champs protégés, absence de session et absence de modification après une erreur.

### DTO comme source des champs autorisés

La Map `profileFields` est retirée. Tous les champs reçus, y compris les champs inconnus, passent directement dans le DTO. `whitelist` et `forbidNonWhitelisted` contrôlent les champs autorisés. La réponse de transformation repart du DTO validé, omet les valeurs undefined et conserve les null autorisés. Aucune conversion entre `name` et `firstname` n’est nécessaire.

### Configuration commune de validation

Les options de class-validator sont centralisées dans `validatorOptions`, dans `validation.config.ts`. Le `ValidationPipe` compose ses options à partir de cette configuration, puis ajoute ses propres paramètres `transform` et `exceptionFactory`. Le hook de profil natif appelle `validate(profile, validatorOptions)` : les règles de liste blanche sont définies une seule fois, et le traitement des erreurs reste adapté à chaque parcours.

## Prénom, nom de famille et nom d’affichage distincts

- Le modèle Prisma conserve `firstname` et `lastname` et ajoute le champ natif Better Auth `name`.
- Le mapping Better Auth `fields: { name: 'firstname' }` est supprimé. `firstname` et `lastname` sont deux champs additionnels distincts, requis dans les comptes provisionnés.
- `buildUserName` calcule le nom d’affichage à partir des deux champs. La création depuis User et la CLI transmet directement les trois propriétés dans l’insertion initiale ; le seeder est également adapté.
- Les PATCH administratifs recalculent le nom d’affichage dans une transaction Serializable lorsque le prénom ou le nom change, en conservant la partie omise.
- `/api/auth/update-user` accepte maintenant `firstname` et `lastname` directement. Le hook récupère la partie conservée, calcule `name`, puis laisse Better Auth modifier le profil et sa session. Un `name` fourni par le client est refusé par le DTO.
- Le DTO détaillé User et les sessions exposent les trois champs. Le client frontend utilise `inferAdditionalFields` pour typer `session.user.firstname`, `session.user.lastname` et les modifications de ces champs.
- La migration `20261024160000_add_user_display_name` ajoute et peuple `name` à partir des données existantes. Un trigger PostgreSQL recalcule ce champ lors des insertions et des mises à jour des noms, à partir de la ligne finale, afin de préserver la cohérence lors de modifications concurrentes ou d’écritures directes.
- Cette migration doit être appliquée avant de démarrer la nouvelle version contre une base existante. Elle n’a pas été appliquée pendant l’intervention. Le test sur PostgreSQL temporaire n’a pas pu être exécuté : le socket Docker n’est pas accessible dans cet environnement, même hors sandbox.
