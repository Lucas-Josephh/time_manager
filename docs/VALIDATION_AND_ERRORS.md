# Validation et erreurs du backend

Cette documentation décrit le comportement des contrôleurs NestJS. Les routes
`/api/auth/*`, servies directement par Better Auth **ne sont pas couvertes par
les règles de validation décrites ici**.

## Répartition des responsabilités

| Couche                | Responsabilité                                                             | Fichier dans `apps/backend/src/`                    |
|-----------------------|----------------------------------------------------------------------------|-----------------------------------------------------|
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

`RequestValidationPipe` est global et instancié par requête. Pour un body associé
à une classe DTO, il transforme les données, vérifie les champs autorisés, puis
applique les règles de validation. Le contrôleur et le service reçoivent les
données uniquement si ces vérifications réussissent. Une validation refusée
interrompt la requête avant l'opération métier ; les validateurs de référence
et d'unicité peuvent toutefois effectuer des lectures en base pendant ce contrôle.

### `transform: true` : fournir au contrôleur un DTO transformé

Le JSON reçu est initialement un objet JavaScript ordinaire. Avec cette option,
le contrôleur reçoit une instance de la classe déclarée sur son paramètre
`@Body()`, par exemple `TeamDto`. Les transformations définies avec
`class-transformer` sont appliquées avant la validation.

Pour les champs d'équipe, `@Transform` supprime les espaces au début et à la fin
des chaînes. Si une requête valide contient `"name": "  Support  "`, le contrôle
d'unicité et le service utilisent donc `"Support"`. Une valeur `"   "` devient
`""` et échoue à la règle `@IsNotEmpty`.

**Comportement attendu :** valider et enregistrer la même valeur nettoyée.
Cette option ne rend pas une valeur invalide valide et ne convertit pas
automatiquement tous les types du body : `"name": 123` reste invalide pour
`@IsString`. Les types TypeScript seuls ne valident pas les données reçues.

### `whitelist: true` : définir les champs acceptés

Seules les propriétés portant au moins un décorateur `class-validator`, comme
`@IsString` ou `@IsOptional`, sont autorisées. Déclarer une propriété dans la
classe TypeScript ou lui ajouter `@ApiProperty` pour Swagger ne suffit pas.
`@Transform` seul ne l'autorise pas non plus.

Avec `whitelist: true` seul, les propriétés non autorisées seraient retirées
avant de transmettre le DTO au contrôleur. Le projet ajoute
`forbidNonWhitelisted: true` pour les refuser explicitement.

### `forbidNonWhitelisted: true` : refuser les champs supplémentaires

Quand le body contient une propriété non autorisée, la requête est rejetée
avec HTTP **400**, au lieu de supprimer silencieusement cette propriété.
Par exemple, ce body de création est refusé à cause de `id` :

```json
{
  "name": "Support",
  "departmentId": "department-it",
  "id": "identifiant-impose-par-le-client"
}
```

**Comportement attendu :** le client reçoit une erreur sur `id` avec le code
`validation_unknown_field`. Le contrôleur n'est pas exécuté et aucune équipe
n'est créée. Cela signale aussi les fautes de frappe dans les noms de champs.
Pour modifier une équipe, son identifiant doit provenir de l'URL, pas du body.

### `validationExceptionFactory` : rendre les erreurs prévisibles

L'option `exceptionFactory` appelle `validationExceptionFactory` lorsque la
validation échoue. Cette fonction transforme les règles invalides en codes
stables par champ et construit une `BadRequestException` (HTTP **400**).
Le filtre global ajoute ensuite l'enveloppe commune de l'API.

Pour le champ supplémentaire `id` de l'exemple précédent, si les autres champs
sont valides, le client reçoit :

```json
{
  "success": false,
  "message": "validation_failed",
  "data": {
    "errors": [
      {
        "field": "id",
        "messages": [
          "validation_unknown_field"
        ]
      }
    ]
  }
}
```

**Comportement attendu :** le frontend utilise `message` pour signaler l'échec
global et `data.errors` pour afficher une erreur sur chaque champ concerné.
La factory ne traduit pas les textes et ne gère pas les erreurs d'écriture
Prisma, qui passent par le mapper du filtre global. La liste des codes et les
règles de priorité sont détaillées plus bas.

### Champs d'une équipe

| Champ          | Création et PUT            | Règles                                                           |
|----------------|----------------------------|------------------------------------------------------------------|
| `name`         | Obligatoire                | Chaîne non vide après trim, 255 caractères maximum, unique       |
| `departmentId` | Obligatoire                | Chaîne non vide après trim, département existant                 |
| `managerId`    | Optionnel ; `null` accepté | Si renseigné, chaîne non vide après trim et utilisateur existant |

`PartialTeamDto`, construit avec `PartialType`, rend les champs optionnels pour
PATCH. Avec la configuration actuelle de `PartialType`, `null` est également
ignoré par la validation des champs optionnels ; les contraintes de base continuent
de s'appliquer. Préférer omettre un champ que l'on ne souhaite pas modifier.

### Références : `@Reference`

`@Reference('department')` ou `@Reference('user')` vérifie l'existence d'un
enregistrement par son `id`, avec `findUnique`. Les règles de type et de présence
restent portées par `@IsString` et `@IsNotEmpty`. Une référence absente produit
`reference_not_found` sur le champ concerné.

### Unicité : `@Unique`

`@Unique('team', 'name')` vérifie avec `findFirst` qu'aucune équipe ne porte ce nom.
La comparaison suit celle de PostgreSQL ; le décorateur ne convertit pas le nom
en minuscules.

Pour PUT et PATCH d'une équipe, le pipe appelle `excludeUniqueRecord` sur le DTO
transformé, avant sa validation. L'identifiant exclu provient de `request.params.id`.
La requête d'unicité devient, par exemple :

```ts
{
  where: {
    name: 'Administration', id
  :
    {
      not: 'team-administration'
    }
  }
,
  select: {
    id: true
  }
}
```

Ainsi, conserver le nom de l'équipe courante est autorisé. Utiliser le nom d'une
autre équipe reste interdit. La création n'exclut aucun enregistrement.
Le contexte est stocké dans un `WeakMap`, séparément des champs du body :
un `id` envoyé par le client ne permet pas de contourner le contrôle.

L'exclusion automatique est actuellement limitée à `TeamDto` et `PartialTeamDto`.
Pour un nouveau DTO de modification, compléter explicitement le pipe avec le modèle
concerné et son identifiant de route ; ne pas récupérer cet identifiant depuis le body.

### Injection des validateurs

`ReferenceExistsConstraint` et `UniqueConstraint` sont des providers de `AppModule`
et reçoivent `PrismaService`. `configureApp` branche `class-validator` au
`ModuleRef` de Nest avec `strict: false` et `fallbackOnErrors: true`.
Ce repli laisse `class-validator` construire ses classes internes, comme `Validator`,
qui ne sont pas des providers Nest. Conserver ce branchement lors de l'initialisation
de l'application et des tests HTTP.

## Format des erreurs de validation

Une validation invalide renvoie HTTP **400** :

```json
{
  "success": false,
  "message": "validation_failed",
  "data": {
    "errors": [
      {
        "field": "name",
        "messages": [
          "already_exists"
        ]
      }
    ]
  }
}
```

La factory conserve une erreur par champ. Les règles `isNotEmpty`, `isDefined`,
puis `isString` sont prioritaires ; sinon, la première règle remontée est retenue.
Les erreurs imbriquées utilisent un chemin avec des points, comme `address.city`.

| Règle                     | Code frontend              |
|---------------------------|----------------------------|
| `isUnique`                | `already_exists`           |
| `referenceExists`         | `reference_not_found`      |
| `isNotEmpty`, `isDefined` | `is_required`              |
| `isString`                | `need_string`              |
| `maxLength`               | `max_length_exceeded`      |
| `minLength`               | `min_length_not_reached`   |
| `isEmail`                 | `invalid_email`            |
| `isInt`                   | `invalid_integer`          |
| `isNumber`                | `invalid_number`           |
| `isBoolean`               | `invalid_boolean`          |
| `isDateString`            | `invalid_date_string`      |
| `isEnum`                  | `invalid_enum_value`       |
| `whitelistValidation`     | `validation_unknown_field` |
| Règle non répertoriée     | `validation_invalid`       |

## Erreurs de base de données

Le filtre appelle `mapPrismaException` avant de formater la réponse.
La traduction est commune aux opérations de tous les services NestJS :

| Code Prisma | Cause                             | HTTP | Message                                          |
|-------------|-----------------------------------|------|--------------------------------------------------|
| `P2002`     | Violation d'une contrainte unique | 409  | `already_exists`                                 |
| `P2003`     | Conflit de clé étrangère          | 409  | `reference_conflict`                             |
| `P2025`     | Enregistrement requis introuvable | 404  | `<modele>_not_found`, ou `not_found` sans modèle |

Pour `P2025`, le nom est tiré de `meta.modelName`, puis converti en `snake_case`.
Une suppression d'équipe inexistante renvoie donc, lorsque Prisma fournit `Team` :

```json
{
  "success": false,
  "message": "team_not_found",
  "data": {}
}
```

Ces erreurs ne contiennent pas de liste de champs. Le frontend doit gérer à la fois
le code global `message` et, pour la validation, `data.errors`.
Un doublon détecté avant l'écriture donne **400 `validation_failed`** avec
`already_exists` sur le champ ; un doublon détecté par la base donne **409 `already_exists`**.

Un utilisateur doit appartenir à une équipe : supprimer une équipe qui possède
encore des membres peut produire **409 `reference_conflict`**. Réaffecter ses membres
avant de la supprimer.

Les codes Prisma non répertoriés et les erreurs inattendues restent des erreurs
serveur : HTTP 500, `internal_server_error`, `data: {}`. Leurs détails sont
journalisés côté backend. Les commandes CLI et le seed ne passent pas par le filtre HTTP.

## Étendre la gestion des erreurs

Pour ajouter une règle de DTO, utiliser un décorateur et compléter
`VALIDATION_CODES` dans la factory si son code n'est pas encore connu.
Pour traduire une nouvelle erreur Prisma, compléter `PRISMA_ERRORS` dans le mapper
avec le statut et le code public, puis ajouter un test du filtre.

Les erreurs métier qui ne correspondent pas à une erreur Prisma peuvent toujours
être levées avec une exception NestJS, par exemple
`new NotFoundException('department_not_found')` après un `findUnique` qui retourne
`null`. Un résultat `null` ne déclenche pas `P2025` automatiquement.

## Documentation Swagger

Les réponses 400, 404, 409 et 500 sont décrites par les décorateurs communs de
`common/swagger/api-response.decorator.ts`. Voir [Documenter l’API](API_DOCUMENTATION.md)
pour leur utilisation. Ces décorateurs ne changent pas la gestion des erreurs.

## Vérification

Depuis la racine :

```bash
pnpm --filter backend exec tsc --noEmit --incremental false
pnpm --filter backend test
```

La liste des tests disponibles se trouve dans `apps/backend/test`.
