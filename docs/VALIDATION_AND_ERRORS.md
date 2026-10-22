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
| Factory de validation | Convertir les règles invalides en codes par champ                          | `common/validation/validation-exception.factory.ts` |
| Service et Prisma     | Exécuter l'opération et faire respecter les contraintes en base            | `team/team.service.ts`                              |
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
- `exceptionFactory` confie les erreurs à `validationExceptionFactory`.

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

L\'unicité en modification dépend de l\'identifiant de la route : elle est donc
contrôlée explicitement dans le service avec `requireUnique(query, field)` :

```ts
await requireUnique(
  prisma.team.findFirst({
    where: { name: dto.name, id: { not: id } },
    select: { id: true },
  }),
  'name',
);
```

Ce helper refuse un résultat non nul avec `already_exists`. Il ne connaît
aucun modèle Prisma. Pour un nouveau modèle, construire sa requête dans son
service et réutiliser la même fonction.

L\'identifiant à exclure en modification est un argument explicite du service,
issu de la route. Aucun identifiant n\'est extrait du body et aucun contexte
n\'est stocké dans un `WeakMap` ou un `AsyncLocalStorage`.

La hiérarchie des organisations est contrôlée dans la transaction du service
avec `checkOrganizationParent`. Un cycle produit l\'erreur de champ
`parentId: organization_cycle`. La transaction sérialisable protège aussi
contre les modifications concurrentes.

### Ordre des contrôles

Les guards d’authentification s’exécutent d’abord sur les routes protégées.
Les routes ciblant une équipe ou une organisation déclarent ensuite
`@ResourceExists('team')` ou `@ResourceExists('organization')`. Ce guard
vérifie l’identifiant de la route avant les pipes : une cible absente produit
une 404 même si le body ou la query est invalide. Le DTO, dont les références
`@Reference`, est validé seulement si la cible existe.

Le guard est générique : le modèle vient du décorateur et les modèles acceptés
sont dérivés de Prisma. Aucun `if/else` par modèle n’est nécessaire.
Le paramètre est configurable :

```ts
@ResourceExists('user', { param: 'userId', trimId: true })
```

Ce décorateur se place sur les méthodes ciblant une ressource, pas sur les
routes de collection. S’il y a un `@UseGuards(AuthGuard)` sur la méthode,
placer `@ResourceExists` au-dessus : Nest enregistrera l’authentification avant
la vérification d’existence. Un guard d’authentification de contrôleur passe
toujours avant les guards de méthode.

La route des utilisateurs disponibles active `trimId` pour respecter son DTO
de paramètres. Les identifiants vides sont laissés à la validation de format.
Les services et les contraintes SQL continuent à protéger les opérations si
une ressource disparaît entre la vérification et l’écriture.

### Construction des erreurs

`validationExceptionFactory` convertit les contraintes en codes par champ et
construit une `BadRequestException`. Le filtre global formate ensuite la réponse.
La factory conserve une erreur par champ : `isNotEmpty`, `isDefined`, puis
`isString` sont prioritaires ; sinon, la première règle remontée est retenue.
Les erreurs imbriquées utilisent un chemin avec des points.

Le registre des correspondances est `VALIDATION_CODES` dans
`common/validation/validation-exception.factory.ts`. Le maintenir dans le code
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
