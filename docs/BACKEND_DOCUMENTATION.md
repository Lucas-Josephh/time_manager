# Documentation du backend

Le backend utilise NestJS, Prisma et PostgreSQL. Better Auth gère
l'authentification avec des sessions stockées en base et des cookies HTTP.
NestJS écoute sur le port **3001** les routes sont préfixées par `/api`.

Pour les DTO, l'unicité en modification et la traduction globale des erreurs
Prisma, consulter [Validation et erreurs](VALIDATION_AND_ERRORS.md).

## Démarrage et configuration

Depuis la racine du projet :

```bash
pnpm install
pnpm prisma:generate
pnpm --filter backend exec prisma migrate deploy
pnpm dev
```

PostgreSQL doit être accessible via `DATABASE_URL`. `pnpm dev` lance les
applications du monorepo pour lancer seulement le backend :
`pnpm --filter backend dev`.

### Chargement des variables

Le serveur NestJS charge, dans cet ordre :

1. `apps/backend/.env`
2. le `.env` à la racine du projet.

Pour une variable présente dans les deux fichiers, `apps/backend/.env` est
prioritaire. Les variables déjà définies dans le processus restent prioritaires
sur les fichiers. La commande `user:create` utilise le même ordre. Les commandes
Prisma et le seeder chargent uniquement le `.env` racine via `prisma.config.ts`.
Centraliser les valeurs dans le `.env` racine et éviter les doublons permet de
conserver une configuration cohérente entre ces commandes et le serveur.

| Variable                                   | Utilisation                                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                             | Connexion PostgreSQL utilisée par Prisma                                                                           |
| `BETTER_AUTH_SECRET`                       | Secret d'au moins 32 caractères conserver sa valeur pour maintenir la validité des cookies                         |
| `BETTER_AUTH_URL`                          | URL publique du backend utilisée notamment pour le retour OAuth                                                    |
| `FRONTEND_URL`                             | Origine exacte du frontend, sans chemin ni slash final utilisée pour CORS et les origines de confiance Better Auth |
| `MICROSOFT_CLIENT_ID`                      | ID de l'application Microsoft Entra                                                                                |
| `MICROSOFT_CLIENT_SECRET`                  | Valeur du secret client Microsoft Entra                                                                            |
| `MICROSOFT_TENANT_ID`                      | GUID du tenant de l'organisation                                                                                   |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Identifiants du compte initial créé par le seeder                                                                  |

Les trois variables Microsoft peuvent être vides pour désactiver le fournisseur.
Une configuration partielle empêche le démarrage. Le tenant doit être un GUID
précis `common`, `organizations` et `consumers` ne sont pas acceptés.

### Ports et URL

| Mode                          | Frontend (`FRONTEND_URL`) | Backend public (`BETTER_AUTH_URL`) | URI de redirection Entra, plateforme Web            |
| ----------------------------- | ------------------------- | ---------------------------------- | --------------------------------------------------- |
| `pnpm dev`                    | `http://localhost:3000`   | `http://localhost:3001`            | `http://localhost:3001/api/auth/callback/microsoft` |
| Docker/Nginx, port par défaut | `http://localhost:8080`   | `http://localhost:8080`            | `http://localhost:8080/api/auth/callback/microsoft` |

En développement, Next.js relaie `/api/auth/*` vers le backend. Avec Docker,
Nginx relaie les requêtes API adapter les URL au port `HTTP_PORT` configuré.
Docker Compose transmet les variables d'authentification au backend et construit
sa connexion PostgreSQL depuis les variables `POSTGRES_*`.
Redémarrer le backend après une modification de sa configuration.

## Base de données

Le schéma se trouve dans `apps/backend/prisma/schema.prisma`.

| Table          | Rôle                                                                  |
| -------------- | --------------------------------------------------------------------- |
| `department`   | Départements et leurs équipes                                         |
| `team`         | Équipes, département, responsable et membres                          |
| `user`         | Profil utilisateur, email unique, rôle administrateur et équipe       |
| `account`      | Identifiants locaux ou association Microsoft mot de passe local haché |
| `session`      | Sessions, expiration, token, adresse IP et agent utilisateur          |
| `verification` | Données temporaires de vérification utilisées par Better Auth         |

Les migrations sont versionnées dans `apps/backend/prisma/migrations`.
Appliquer les migrations existantes avec
`pnpm --filter backend exec prisma migrate deploy`. Pour créer une migration
pendant le développement, utiliser `pnpm prisma:migrate`.
`pnpm prisma:studio` ouvre l'interface de consultation et modification des données.

Un utilisateur peut être sans équipe (`user.teamId` nullable).
Le responsable d'une équipe est optionnel (`team.managerId` nullable), ce qui
permet de créer l'équipe avant son premier utilisateur. La suppression d'une
équipe ayant encore des membres est restreinte : réaffecter les utilisateurs avant
de la supprimer.

## Modification des membres d\'une équipe

Pour `PATCH /api/team/:id`, le responsable est
**toujours membre** de l\'équipe : il est ajouté automatiquement même s\'il est
absent de `memberIds`. Son affectation respecte les droits de l’auteur de la requête.

- **Administrateur** : ajout ou transfert de tout utilisateur, quelle que soit son organisation, y compris si elle est nulle.
- **Manager d’organisation** : ajout ou transfert des utilisateurs de son organisation et de ses descendantes, entre les équipes de ce périmètre. Un utilisateur rattaché à une équipe extérieure ne peut pas être transféré.
- **Responsable d’équipe** : ajout uniquement des utilisateurs sans équipe, rattachés à l’organisation de son équipe ou à ses descendantes.

L’affectation conserve toujours `user.organizationId`. Un membre déjà présent peut être conservé même s’il appartient à une autre organisation. Le transfert d’un responsable retire son rôle dans son ancienne équipe, dans la même transaction.

`GET /api/team/available-users` ne requiert aucune équipe cible : le périmètre est calculé depuis l’utilisateur authentifié. Les administrateurs voient tous les utilisateurs ; les managers d’organisation voient les utilisateurs de leurs organisations et descendants, libres ou transférables depuis une équipe du même périmètre ; les responsables d’équipe voient les utilisateurs libres des organisations de leurs équipes et descendants. Les périmètres se cumulent. Aucun membre n’est exclu au titre d’une équipe cible. Sans droit de gestion : `403`. Les droits et l’éligibilité pour l’organisation cible restent vérifiés lors de la création ou modification ; la liste n’accorde aucun droit de création supplémentaire.

Les appartenances utilisateur et équipe ne sont pas un invariant de la hiérarchie : déplacer une organisation conserve les appartenances existantes, sans imposer aux utilisateurs de rejoindre une autre équipe.

| Champs envoyés                                  | Résultat                                                                            |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| `memberIds: []`, responsable conservé ou défini | Seul le responsable reste membre.                                                   |
| `memberIds: []` et `managerId: null`            | Aucun responsable et aucun membre : l\'équipe est vide.                             |
| `memberIds` omis                                | Les membres existants sont conservés ; le nouveau responsable est ajouté si défini. |
| `managerId: null`, `memberIds` omis             | Le rôle de responsable est retiré ; l\'ancien responsable reste membre.             |

Pour vider une équipe avec `PATCH` :

```json
{
  "memberIds": [],
  "managerId": null
}
```

Une liste `memberIds` non vide remplace les membres, en y incluant toujours
le responsable conservé ou défini. Toutes les modifications sont atomiques :
un utilisateur indisponible provoque une erreur `409 team_members_unavailable`,
avec les utilisateurs concernés dans `data.unavailableMembers`, et annule
l\'opération entière.

## Création des utilisateurs

L'inscription publique est désactivée, y compris via Microsoft. L'utilisateur
Time Manager doit exister avant sa première connexion.

### Utilisateur pour Microsoft 365

```bash
pnpm --filter backend user:create \
  --email alice@entreprise.fr \
  --firstname Alice \
  --lastname Dupont \
  --team-id team-administration
```

Cette commande crée uniquement le profil local, sans mot de passe ni compte
Microsoft associé. Elle normalise l'email en minuscules et refuse les doublons.
`--team-id` est obligatoire et doit désigner une équipe existante.
L'utilisateur est créé avec `isAdmin: false` et `emailVerified: false`.
Il pourra se connecter avec Microsoft si l'email renvoyé correspond à ce profil.

### Compte initial avec mot de passe

Définir `SEED_ADMIN_EMAIL` et `SEED_ADMIN_PASSWORD` dans le `.env` racine, puis :

```bash
pnpm prisma:db:seed
```

Le seeder crée ou retrouve le compte par email, crée ses identifiants locaux
s'ils sont absents et initialise cinq départements. Un nouvel utilisateur est
créé comme administrateur avec un email vérifié et rattaché à l'équipe
`Administration`, créée si nécessaire dans `department-operations`.
Si cette équipe n'a pas de responsable, le seeder lui affecte ce compte.
Pour un utilisateur existant,
le profil et le rôle sont conservés un mot de passe existant n'est pas remplacé.
Utiliser un email en minuscules, le seeder ne le normalisant pas.

## Documentation de l\'API

Swagger est la référence pour les routes NestJS, les paramètres, les DTO,
les statuts HTTP et les exemples de réponses :

- En local : <http://localhost:3001/api/docs>.
- Via Docker/Nginx : <http://localhost:8080/api/docs>.
- Spécifications exportables : `/api/docs-json` et `/api/docs-yaml`.

## Développer un contrôleur NestJS

Retourner les données directement ; `ResponseInterceptor` construit l\'enveloppe.
Choisir le message avec `@ResponseMessage(...)` et le DTO de sortie avec
`@SerializeResponse(...)`. Ne pas construire une seconde enveloppe dans le
contrôleur. Voir les [conventions de sérialisation](../apps/backend/src/common/serialization/README.md).

Lever une exception NestJS pour signaler un échec ; `HttpExceptionFilter` la
formate. Pour une recherche obligatoire, utiliser `requireResource`. Les services
laissent remonter les erreurs Prisma connues, traduites par le mapper commun.
Voir [Validation et erreurs](VALIDATION_AND_ERRORS.md) pour leur fonctionnement.

Documenter chaque route avec `@ApiTags`, `@ApiOperation` et les décorateurs de
`common/swagger/api-response.decorator.ts`, notamment `ApiSuccessResponse`
et les réponses d\'erreur adaptées. Décrire les propriétés des DTO avec
`@ApiProperty` ou `@ApiPropertyOptional` et les paramètres de route et de recherche
avec les décorateurs Swagger correspondants. Les décorateurs Swagger décrivent
le contrat ; ils ne remplacent ni la validation ni la sérialisation.

## Authentification

### Better Auth : circuit de réponse distinct

**Les routes `/api/auth/*` gérées par Better Auth ne passent pas par
`ResponseInterceptor` ni par `HttpExceptionFilter` NestJS. Elles ne reçoivent
donc pas l'enveloppe `{ success, message, data }`, y compris pour leurs erreurs.**

Dans `apps/backend/src/configure-app.ts`, elles sont prises en charge directement
par le middleware :

```ts
app.use('/api/auth', toNodeHandler(app.get(AuthService).auth));
```

Better Auth construit ses propres réponses et conserve le format attendu par
son client frontend. Par exemple, `/api/auth/get-session` retourne
`{ session, user }` ou `null`, sans enveloppe NestJS.

Un contrôleur NestJS qui utilise `AuthService` ou `AuthGuard` pour vérifier une
session reste dans le circuit NestJS : ses réponses et ses exceptions non gérées
sont traitées par l'interceptor et le filtre. C'est le handler HTTP Better Auth
sous `/api/auth`, et non tout code utilisant Better Auth, qui suit le circuit distinct.

### Authentification Better Auth

Les principales routes utilisées par le frontend sont :

| Route                              | Utilisation                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------- |
| `POST /api/auth/sign-in/email`     | JSON `{ "email": "…", "password": "…" }` connexion et cookie de session                     |
| `POST /api/auth/sign-in/social`    | Démarre la connexion Microsoft et renvoie l'URL d'autorisation avec `disableRedirect: true` |
| `GET /api/auth/callback/microsoft` | Retour OAuth traité par Better Auth après la connexion chez Microsoft                       |
| `GET /api/auth/get-session`        | Retourne `{ session, user }`, ou `null` sans session valide                                 |
| `POST /api/auth/sign-out`          | Révoque la session et efface les cookies                                                    |
| `GET /api/auth/ok`                 | Vérifie la disponibilité du handler                                                         |

Exemple de corps pour démarrer Microsoft en développement :

```json
{
  "provider": "microsoft",
  "callbackURL": "http://localhost:3000",
  "errorCallbackURL": "http://localhost:3000/?error=microsoft",
  "disableRedirect": true
}
```

`callbackURL` est l'adresse du frontend après la connexion. L'URI de redirection
Entra est l'adresse du callback **backend**, construite depuis `BETTER_AUTH_URL`.
Le frontend utilise le client React Better Auth, défini dans
`apps/frontend/src/lib/auth-client.ts`. Les méthodes `signIn.email`,
`signIn.social` et `signOut` gèrent les connexions et la déconnexion. Le hook
`useSession` lit et synchronise la session ; le client gère les cookies et
la redirection vers Microsoft. Les requêtes ciblent `/api/auth` sur la même
origine, via Next.js en développement ou Nginx avec Docker.

Les anciennes routes personnalisées `/login`, `/logout`, `/refresh` et `/me`
ne sont pas exposées. Le plugin JWT est absent : `/api/auth/token` et
`/api/auth/jwks` ne sont pas exposés. L'envoi d'emails n'est pas configuré.

### Association Microsoft

Le fournisseur Microsoft utilise le tenant configuré et refuse la création de
nouveaux utilisateurs. Lors de la première connexion, Better Auth associe
Microsoft à l'utilisateur existant ayant le même email :

- `enabled: true` active l'association de comptes
- `disableImplicitLinking: false` autorise l'association automatique
- `trustedProviders: ['microsoft']` désigne Microsoft comme fournisseur de confiance
- `requireLocalEmailVerified: false` permet l'association à un profil local dont l'email n'a pas été vérifié
- `allowDifferentEmails: false` impose des emails identiques.

L'utilisateur n'a pas besoin d'un mot de passe local pour cette association.
Son rôle et ses informations métier sont conservés. Les connexions suivantes
réutilisent le compte associé. La récupération de la photo Microsoft est désactivée.
Voir le [guide Microsoft 365](MICROSOFT_AUTH.md) pour la configuration Entra.

### Sessions et protection des routes

Les sessions durent sept jours et sont renouvelées après un jour d'activité.
Le cache de session dans les cookies est désactivé. Le cookie est HttpOnly,
SameSite=Lax et Secure lorsque `BETTER_AUTH_URL` utilise HTTPS.
Les contrôles d'origine et CSRF sont activés, ainsi que la limitation des requêtes.
CORS autorise `FRONTEND_URL` avec credentials. Better Auth utilise cette origine
comme origine de confiance, en plus de son URL de base.

Better Auth expose trois champs distincts : `user.firstname` (prénom),
`user.lastname` (nom de famille) et `user.name` (nom d’affichage calculé comme
prénom + espace + nom). Le mapping de `name` vers `firstname` est supprimé.
Les DTO User acceptent `firstname` et `lastname`, sans exposer `name` en écriture.
Les routes Better Auth conservent leur validation et leurs réponses natives,
sans passer par les DTO NestJS. Le hook de profil synchronise seulement le nom
d’affichage lorsque le prénom ou le nom change. Le trigger en base maintient
également ce nom calculé lors des écritures.
Les champs `phone`, `teamId` et `isAdmin` restent également exposés.
`teamId` et `isAdmin` ne sont pas modifiables via les entrées utilisateur Better Auth.
La migration `20261024160000_add_user_display_name` peuple le nom d’affichage
pour les comptes existants et installe sa synchronisation en base.

`AuthModule` exporte `AuthGuard` pour protéger les contrôleurs avec
`@UseGuards(AuthGuard)`. Le guard vérifie la session depuis les en-têtes de la
requête, renvoie une erreur 401 si elle est invalide et ajoute les données à
`request.session`. Il ne vérifie pas le rôle administrateur.

## Exemples avec cookies

Pour un backend lancé directement, avec `FRONTEND_URL=http://localhost:3000` :

```bash
curl -c cookies.txt http://localhost:3001/api/auth/sign-in/email \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:3000' \
  -d '{"email":"admin@example.com","password":"mot-de-passe-du-seeder"}'

curl -b cookies.txt -c cookies.txt http://localhost:3001/api/auth/get-session

curl -b cookies.txt -c cookies.txt -X POST \
  -H 'Origin: http://localhost:3000' \
  http://localhost:3001/api/auth/sign-out
```

Pour Docker/Nginx, remplacer les origines et URL par `http://localhost:8080`
(ou le port public configuré).

## Dépannage

### Migration d'équipe ou seed bloqué

Si le seed échoue avec `P2011` lors de la création d'une équipe, vérifier que
la migration `20261014110000_team_manager_optional` est appliquée : elle retire
la contrainte `NOT NULL` de `team.managerId` pour aligner la base sur le schéma.
Générer le client Prisma ne modifie pas les contraintes de PostgreSQL.

La migration `20261014120000_user_team_required` refuse les utilisateurs dont
`teamId` est nul. Affecter chacun à une équipe existante avant de la relancer.
Le seed conserve le profil des utilisateurs existants et ne réaffecte pas
automatiquement ces utilisateurs.

Si Prisma a enregistré cette migration comme échouée, vérifier d'abord que ses
changements n'ont pas été appliqués, corriger les données, puis :

```bash
pnpm --filter backend exec prisma migrate resolve --rolled-back 20261014120000_user_team_required
pnpm prisma:migrate
pnpm prisma:generate
pnpm prisma:db:seed
```

`migrate resolve --rolled-back` modifie l'historique Prisma ; il n'annule pas
les changements SQL. La migration actuelle regroupe ses opérations dans un
bloc atomique, mais il faut vérifier l'état réel si une autre version a été exécutée.

### Authentification et configuration

- **`INVALID_CALLBACK_URL`** : l'origine de `callbackURL` doit être autorisée. Vérifier que `FRONTEND_URL` correspond
  exactement à l'adresse ouverte dans le navigateur, puis redémarrer le backend.
- **`AADSTS500113`** : ajouter l'URI de redirection backend dans l'application Entra, sous **Authentification →
  plateforme Web**. En développement : `http://localhost:3001/api/auth/callback/microsoft`.
- **Connexion Microsoft refusée après authentification** : vérifier le tenant et l'existence d'un utilisateur local dont
  l'email correspond à celui renvoyé par Microsoft.
- **Configuration différente entre Prisma et NestJS** : vérifier les doublons entre `apps/backend/.env`, le `.env`
  racine et les variables du processus.

## Vérification

```bash
pnpm --filter backend test
```

Les tests couvrent la santé de l'API, les sessions cookies, les contrôles d'origine,
la limitation des requêtes, la déconnexion et le parcours Microsoft avec une base
en mémoire. Les réponses externes de Microsoft sont simulées une connexion
avec un vrai tenant reste nécessaire pour valider la configuration Entra.
Les tests `api-documentation.spec.ts` et `response-serialization.spec.ts` vérifient
les schémas OpenAPI et le filtrage des réponses, sans base réelle.


## Pagination des listes

`GET /api/users`, `GET /api/team` et `GET /api/organizations` acceptent
`page` (entier >= 1, défaut 1) et `limit` (entier entre 1 et 100, défaut 10).
Les filtres existants sont cumulables avec ces paramètres.

Les résultats se trouvent dans `data.items`. `data.meta` contient `total`
(nombre de résultats filtrés), `page`, `limit` et `totalPages`.
Une page hors limites renvoie une liste vide ; si aucun résultat ne correspond,
`totalPages` vaut 0. Team et Organization ne renvoient plus de tableau direct dans `data`.
Les arbres d’organisations et les utilisateurs disponibles pour une équipe ne sont pas concernés.

Les routes `GET /api/organizations/tree` et `GET /api/organizations/:id/tree`
ne prennent aucun paramètre de query : elles renvoient toutes les branches autorisées
ou le sous-arbre ciblé par `:id`. Les anciens filtres `name`, `managerId` et `parentId`
ne s’y appliquent plus. Les filtres de la liste paginée restent disponibles.
