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
| DTO et décorateurs    | Décrire les champs, leur format, leur unicité et leurs références          | `team/dto/team.dto.ts`, `common/decorator/`         |
| Pipe global           | Transformer le body, valider le DTO et fournir le contexte de modification | `common/validation/request-validation.pipe.ts`      |
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

`RequestValidationPipe` est global et instancié par requête. Il transforme les
entrées en instances de DTO avant de les valider :

- `transform: true` applique les transformations `class-transformer` avant les
  contrôles. Les types TypeScript ne remplacent pas les règles de validation.
- `whitelist: true` reconnaît les propriétés portant un décorateur
  `class-validator`. `@ApiProperty` ou `@Transform` seuls ne suffisent pas.
- `forbidNonWhitelisted: true` refuse les propriétés supplémentaires.
- `exceptionFactory` confie les erreurs à `validationExceptionFactory`.

Une validation refusée interrompt la requête avant le contrôleur et le service.
Les validateurs de référence et d’unicité peuvent effectuer des lectures en base.

### Références et unicité

`@Reference(model)` vérifie l’existence d’un identifiant avec `findUnique`.
Les règles de type et de présence restent portées par les décorateurs du DTO.

`@Unique(model, field)` recherche un doublon avec `findFirst`. La comparaison suit
celle de PostgreSQL ; le décorateur ne normalise pas la casse.

Pour les modifications d’équipe, le pipe appelle `excludeUniqueRecord` avant la
validation pour exclure l’enregistrement courant. L’identifiant provient de
`request.params.id`, jamais du body. Le contexte est stocké dans un `WeakMap`,
séparément des données fournies par le client.

Le pipe configure également le contexte de validation de la hiérarchie pour les
DTO d’organisation. Pour un nouveau DTO de modification nécessitant ce contexte,
compléter explicitement `applyUpdateContext`.

### Injection des validateurs

Les contraintes de validation sont des providers NestJS recevant `PrismaService`.
`configureApp` branche `class-validator` au `ModuleRef` avec `strict: false` et
`fallbackOnErrors: true`. Ce repli permet la construction des classes internes
de `class-validator` qui ne sont pas des providers Nest. Conserver ce branchement
lors de l’initialisation de l’application et des tests HTTP.

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
`common/filters/prisma-exception.mapper.ts`. Les services n’ont pas à répéter
ces traductions dans des `try/catch`.

Les erreurs inattendues sont journalisées côté backend ; leurs détails ne sont
pas exposés au client. Les commandes CLI et le seed ne passent pas par ce filtre.

## Affectation des membres

La création et la modification des membres d’une équipe sont transactionnelles.
L’affectation conditionnelle empêche de transférer un utilisateur affecté par une
requête concurrente. En modification, l’écriture de l’équipe verrouille celle-ci
pour sérialiser les remplacements concurrents. Une affectation impossible annule
la transaction. Les règles d’entrée et les réponses sont décrites dans Swagger.

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

Lorsqu’un contrat change, mettre à jour les DTO, les décorateurs Swagger et les
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
