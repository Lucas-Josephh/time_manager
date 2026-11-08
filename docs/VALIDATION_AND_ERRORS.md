# Validation et erreurs du backend

Ce guide décrit les mécanismes internes et les conventions de développement.
Les champs acceptés, les réponses HTTP et leurs exemples sont documentés dans
[Swagger](http://localhost:3001/api/docs) (via Docker :
<http://localhost:8080/api/docs>).

Les routes `/api/auth/*`, servies directement par Better Auth, suivent leur
propre circuit ; voir la [documentation du backend](BACKEND_DOCUMENTATION.md#authentification).

## Répartition des responsabilités

| Couche                | Responsabilité                                                             | Fichier dans `apps/backend/src/`                    |
| --------------------- | -------------------------------------------------------------------------- | --------------------------------------------------- |
| DTO et décorateurs    | Décrire les champs et leur format | `team/dto/team.dto.ts` |
| Pipe global | Transformer les entrées et valider leur format | `common/validation/validation.config.ts` |
| Formatage de validation | Convertir les règles invalides en codes par champ                          | `common/validation/format-validation-errors.ts` |
| Service et Prisma     | Exécuter l'opération et faire respecter les contraintes en base            | `team/services/team.service.ts`                              |
| Mapper Prisma         | Traduire les erreurs Prisma connues en exceptions HTTP                     | `common/filters/prisma-exception.mapper.ts`         |
| Filtre global         | Produire l'enveloppe JSON des erreurs                                      | `common/filters/http-exception.filter.ts`           |

`AppModule` enregistre le pipe via `APP_PIPE` et le filtre via `APP_FILTER`.
Le service laisse remonter les erreurs Prisma : il n'a pas à répéter des
`try/catch` pour une ressource absente ou un doublon.

Les décorateurs permettent de signaler les erreurs avant l'écriture. Les contraintes
SQL restent nécessaires : une autre requête peut modifier la base entre la
validation et l'opération Prisma. Le filtre gère aussi ces conflits concurrents.

## Validation des DTO

Le `ValidationPipe` standard de Nest est global. Sa configuration est dans
`common/validation/validation.config.ts`. Il transforme les entrées en instances
de DTO avant de les valider :

- `transform: true` applique les transformations `class-transformer` avant les
  contrôles. Les types TypeScript ne remplacent pas les règles de validation.
- `whitelist: true` reconnaît les propriétés portant un décorateur
  `class-validator`. `@ApiProperty` ou `@Transform` seuls ne suffisent pas.
- `forbidNonWhitelisted: true` refuse les propriétés supplémentaires.
- `exceptionFactory` construit une `ValidationException` après formatage des erreurs.

Une validation refusée interrompt la requête avant le contrôleur et le service.
Le décorateur `@Reference(model)` peut effectuer une lecture en base.

### Références et unicité

`@Reference(model)` est conservé dans les DTO. Il vérifie qu\'un identifiant
existe avec `findUnique`. Les noms de modèles acceptés sont dérivés de Prisma,
sans liste de cas à maintenir. Les règles de format restent dans `@IsString`
et `@IsNotEmpty`, et les références optionnelles utilisent `@IsOptional`.
Une référence absente produit `reference_not_found`. Une panne de base reste
une erreur serveur.

`ReferenceExistsConstraint` reçoit `PrismaService` via Nest. Le branchement
`useContainer` dans `configureApp` permet cette injection ; `fallbackOnErrors`
laisse `class-validator` construire ses propres classes internes.

`@Unique(model, field, filter?)` vérifie l'unicité avec `findFirst`.
Le filtre Prisma est typé selon le modèle. Il peut être fixe ou calculé avec
`({ request, object }) => filter`. `object` est le DTO en cours de validation ;
`request` contient la méthode HTTP et les paramètres de route, ou vaut
`undefined` hors d'une requête HTTP.

```ts
@Unique('team', 'name', { organizationId: 'organization-1' })
```

Pour exclure la ressource en modification :

```ts
@Unique('team', 'name', ({ request }) => {
  const id = request?.params.id;
  return request?.method === 'PATCH' && typeof id === 'string'
    ? { id: { not: id } }
    : {};
})
```

Le filtre est combiné avec la valeur du champ via `AND`. Un filtre vide
vérifie l'unicité globale. Un doublon produit `already_exists`.
Le contexte de requête est isolé avec `AsyncLocalStorage`, y compris lors
de requêtes concurrentes. L'ID exclu dans cet exemple provient de la route.

La hiérarchie des organisations est contrôlée dans la transaction du service
avec `validateOrganizationHierarchy`. Un cycle produit l\'erreur de champ
`parentId: organization_cycle`. La transaction sérialisable protège aussi
contre les modifications concurrentes.

### Ordre des contrôles

Les guards d’authentification s’exécutent d’abord sur les routes protégées.
Pour User, Team et Organization, les DTO sont ensuite validés, puis les services
chargent les cibles et vérifient les droits. Pour les écritures, ces lectures,
les contrôles d’autorisation et les mutations utilisent la même transaction
Serializable. Un body invalide renvoie 400 avant toute recherche de cible ;
une cible absente avec un body valide renvoie 404.

Les identifiants de la query des utilisateurs disponibles sont nettoyés par leur DTO
de paramètres. Les identifiants vides sont laissés à la validation de format.
Les services et les contraintes SQL continuent à protéger les opérations si
une ressource disparaît entre la validation et l’écriture.

### Construction des erreurs

`formatValidationErrors` convertit les contraintes en codes par champ.
Le pipe construit une `ValidationException`, dérivée de `BadRequestException`,
puis le filtre global formate la réponse.
Le formatage conserve une erreur par champ : `isNotEmpty`, `isDefined`, puis
`isString` sont prioritaires ; sinon, la première règle remontée est retenue.
`data.errors` est un objet indexé par nom d’input. Les champs imbriqués
utilisent des crochets à chaque niveau, par exemple
`weeklySchedule[1][0][startTime]` (heure de début du premier créneau du lundi).

```json
{
  "success": false,
  "message": "validation_failed",
  "data": {
    "errors": {
      "name": { "messages": ["is_required"] },
      "userIds[2]": { "messages": ["outside_management_scope"] }
    }
  }
}
```

Ce format remplace l’ancien tableau `{ field, messages }` : les consommateurs
doivent utiliser `errors[input.name]?.messages`. Une erreur de groupe utilise
`userIds` ; une erreur sur une case utilise `userIds[index]`, avec un index
commençant à zéro dans la requête initiale. Les valeurs reçues ne sont pas
recopiées dans les erreurs.

Un validateur qui contrôle plusieurs champs peut fournir un formateur détaillé
via `ValidationOptions.context.fieldErrors(value, field)`. Ce formateur renvoie
le même objet d’erreurs, avec les chemins complets. Le validateur doit définir
un `message` non vide pour que class-validator transmette son contexte.
La validation de la semaine l’utilise pour signaler une fin avant le début sur
`weeklySchedule[1][0][endTime]` et les chevauchements sur le `startTime` des
créneaux concernés. Les vérifications directes du service utilisent le même
collecteur d’erreurs.

`FieldErrorsBuilder` centralise la construction des chemins et la préparation
des erreurs. Il conserve l’ordre des messages, supprime les doublons et retourne
une copie indépendante via `toObject()` :

```ts
const errors = new FieldErrorsBuilder();
errors.add('name', 'is_required');
errors.at('userIds', index).add('outside_management_scope');
errors.at('weeklySchedule', day, slotIndex, 'endTime')
  .add('schedule_end_time_must_follow_start_time');

if (errors.hasErrors()) {
  throw errors.exception(ForbiddenException, 'schedule_assignment_forbidden');
}
```

`errors.exception(NotFoundException)` construit une véritable exception Nest
contenant `data.errors`, sans code générique redondant : le filtre déduit
`not_found` du statut 404. Un second argument facultatif permet un code métier
plus précis, et un troisième conserve les détails additionnels :

```ts
throw missing.exception(NotFoundException);
throw errors.exception(ConflictException, 'later_schedule_assignment_exists', {
  conflictingAssignments,
});
```

`fieldErrorsResponse` et `ValidationException` acceptent directement le collecteur
ou un objet d’erreurs. La conversion du collecteur est faite au moment de
construire la réponse ; aucun état interne n’est exposé.

`merge(errors)` permet d’agréger un formateur personnalisé. Le collecteur ne
vérifie aucun droit : le service choisit la classe d’exception et, si nécessaire,
un code métier.

Les services peuvent utiliser `fieldErrorsResponse(message, errors, details?)`
avec une exception 403, 404 ou 409 : le format des champs est commun aux DTO,
mais le statut et le code métier sont conservés. Les détails additionnels,
comme `conflictingAssignments`, restent dans `data`. Les permissions et les
contrôles dépendant de la base restent dans la transaction du service.

Le registre des correspondances est `VALIDATION_CODES` dans
`common/validation/format-validation-errors.ts`. Le maintenir dans le code
plutôt que recopier sa liste dans ce guide.

## Erreurs de base de données

Le filtre appelle `mapPrismaException` avant de formater la réponse. Le registre
`PRISMA_ERRORS` centralise les traductions dans
`common/filters/prisma-exception.mapper.ts`. Les services n\'ont pas à répéter
ces traductions dans des `try/catch`.

Les erreurs inattendues sont journalisées côté backend ; leurs détails ne sont
pas exposés au client. Les commandes CLI et le seed ne passent pas par ce filtre.

## Affectation des membres

La création et la modification des membres d\'une équipe sont transactionnelles.
L\'affectation conditionnelle empêche de transférer un utilisateur affecté par une
requête concurrente. En modification, l\'écriture de l\'équipe verrouille celle-ci
pour sérialiser les remplacements concurrents. Une affectation impossible annule
la transaction. Les règles d\'entrée et les réponses sont décrites dans Swagger.

## Étendre la gestion des erreurs

Pour ajouter une règle de DTO, utiliser un décorateur et compléter
`VALIDATION_CODES` si nécessaire. Pour traduire une nouvelle erreur Prisma,
compléter `PRISMA_ERRORS` et vérifier le comportement du filtre.

Pour une recherche obligatoire, utiliser :

```ts
return requireResource(prisma.team.findUnique({ where: { id } }));
```

Le helper retourne la ressource sans `null` ou lève une `NotFoundException`.
Une recherche facultative conserve son résultat `null`. Un résultat `null` ne
déclenche pas `P2025` automatiquement. Les écritures directes restent prises en
charge par le mapper Prisma, sans recherche préalable systématique.

Lorsqu\'un contrat change, mettre à jour les DTO, les décorateurs Swagger et les
tests concernés. Les conventions de contribution sont décrites dans la
[documentation du backend](BACKEND_DOCUMENTATION.md#développer-un-contrôleur-nestjs).

## Vérification

Depuis la racine :

```bash
pnpm --filter backend exec tsc --noEmit -p tsconfig.build.json
pnpm --filter backend test
```

Les tests se trouvent dans `apps/backend/test`, notamment
`api-documentation.spec.ts` pour les schémas OpenAPI.

### Exception de validation personnalisée

`ValidationException` (`common/validation/validation.exception.ts`) étend `BadRequestException` et conserve le statut HTTP 400 et l’enveloppe `{ message: 'validation_failed', data: { errors } }`. Les services peuvent lever `ValidationException.forField(field, code)`. Le `ValidationPipe` construit cette même exception après conversion des erreurs class-validator par `formatValidationErrors`.
