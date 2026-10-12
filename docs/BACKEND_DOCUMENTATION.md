# Documentation du backend

Le backend utilise NestJS, Prisma et PostgreSQL. Better Auth gère
l'authentification avec des sessions stockées en base et des cookies HTTP.
NestJS écoute sur le port **3001** les routes sont préfixées par `/api`.

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

- `GET /api/users` : Récupère la liste de tous les utilisateurs (avec pagination et filtres).
- `GET /api/users/:id` : Récupère les informations d'un utilisateur spécifique par son ID.
- `PUT /api/users/:id` : Met à jour les informations d'un utilisateur spécifique
- `DELETE /api/users/:id` : Supprime un utilisateur spécifique par son ID.
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

L'historique contient actuellement la migration `20261007112352_init`.
Appliquer les migrations existantes avec
`pnpm --filter backend exec prisma migrate deploy`. Pour créer une migration
pendant le développement, utiliser `pnpm prisma:migrate`.
`pnpm prisma:studio` ouvre l'interface de consultation et modification des données.

## Création des utilisateurs

L'inscription publique est désactivée, y compris via Microsoft. L'utilisateur
Time Manager doit exister avant sa première connexion.

### Utilisateur pour Microsoft 365

```bash
pnpm --filter backend user:create \
  --email alice@entreprise.fr \
  --firstname Alice \
  --lastname Dupont
```

Cette commande crée uniquement le profil local, sans mot de passe ni compte
Microsoft associé. Elle normalise l'email en minuscules et refuse les doublons.
L'utilisateur est créé avec `isAdmin: false` et `emailVerified: false`.
Il pourra se connecter avec Microsoft si l'email renvoyé correspond à ce profil.

### Compte initial avec mot de passe

Définir `SEED_ADMIN_EMAIL` et `SEED_ADMIN_PASSWORD` dans le `.env` racine, puis :

```bash
pnpm prisma:db:seed
```

Le seeder crée ou retrouve le compte par email, crée ses identifiants locaux
s'ils sont absents et initialise cinq départements. Un nouvel utilisateur est
créé comme administrateur avec un email vérifié. Pour un utilisateur existant,
le profil et le rôle sont conservés un mot de passe existant n'est pas remplacé.
Utiliser un email en minuscules, le seeder ne le normalisant pas.

## Routes disponibles

### Santé et Swagger

| Route                | Réponse ou contenu                                                 |
| -------------------- | ------------------------------------------------------------------ |
| `GET /api/health`    | `{ "success": true, "message": "request_successful", "data": { "status": "ok" } }` public, ne vérifie pas la connexion à la base |
| `GET /api/docs`      | Interface Swagger des contrôleurs NestJS                           |
| `GET /api/docs-json` | Document OpenAPI JSON                                              |
| `GET /api/docs-yaml` | Document OpenAPI YAML                                              |

Swagger documente les contrôleurs NestJS uniquement. Le handler Better Auth,
monté sous `/api/auth`, n'est pas inclus dans ce document.

### Répondre depuis un contrôleur NestJS

Les réponses JSON des contrôleurs NestJS utilisent cette enveloppe :

```json
{
  "success": true,
  "message": "users_retrieved",
  "data": []
}
```

- `success` indique si la requête a réussi.
- `message` est un code en `snake_case`, par exemple `users_retrieved` ou
  `user_not_found`. Ce code permet au frontend de choisir le texte à afficher.
- `data` contient les données retournées par le contrôleur : objet, liste ou
  autre valeur JSON. Un retour `null` ou `undefined` devient `{}`.

`ResponseInterceptor` et `HttpExceptionFilter` sont enregistrés globalement
dans `AppModule` via `APP_INTERCEPTOR` et `APP_FILTER`.

#### Retourner un succès

Retourner uniquement les données depuis le contrôleur et choisir le message
avec `@ResponseMessage(...)`. Exemple pour un futur contrôleur utilisateurs :

```ts
import { Controller, Get } from '@nestjs/common';
import { ResponseMessage } from './common/decorator/response-message.decorator';

@Controller('users')
export class UsersController {
  @Get()
  @ResponseMessage('users_retrieved')
  findAll() {
    return [{ id: '123', firstname: 'Alice' }];
  }
}
```

Cet exemple suppose un contrôleur placé directement dans `src` ; adapter le
chemin de l'import à son emplacement et enregistrer le contrôleur dans un module.
L'interceptor transforme son résultat en :

```json
{
  "success": true,
  "message": "users_retrieved",
  "data": [{ "id": "123", "firstname": "Alice" }]
}
```

Le décorateur stocke le message dans les métadonnées de la méthode ;
l'interceptor le lit avec `Reflector`. Sans décorateur, le message est
`request_successful`. Il peut aussi être défini sur la classe du contrôleur ;
le message de la méthode est prioritaire.

**Ne pas retourner soi-même `{ success, message, data }` dans le contrôleur** :
l'interceptor ajouterait une seconde enveloppe. Utiliser le retour normal de
la méthode ; une réponse envoyée directement avec `@Res()` contourne cette
transformation.

#### Retourner une erreur

Lever une exception NestJS depuis le contrôleur ou le service :

```ts
import { NotFoundException } from '@nestjs/common';

throw new NotFoundException('user_not_found');
```

Le filtre renvoie le statut HTTP **404** avec :

```json
{
  "success": false,
  "message": "user_not_found",
  "data": {}
}
```

Le message personnalisé est accepté pour les erreurs HTTP inférieures à 500
s'il respecte `^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$`. Une phrase ou une liste de
messages utilise le code par défaut du statut :

| Statut HTTP | Message par défaut |
| ----------- | ------------------ |
| 400 | `bad_request` |
| 401 | `unauthorized` |
| 403 | `forbidden` |
| 404 | `not_found` |
| 405 | `method_not_allowed` |
| 409 | `conflict` |
| 422 | `validation_failed` |
| 429 | `too_many_requests` |
| Autre statut inférieur à 500 | `request_failed` |
| 500 et plus | `internal_server_error` |

Une exception inattendue produit un statut 500. Les détails des erreurs serveur
sont journalisés côté backend ; la réponse contient uniquement
`internal_server_error` et `data: {}`. Le filtre traite les exceptions non gérées :
retourner un objet d'erreur au lieu de lever une exception serait considéré
comme un succès par l'interceptor.

Conserver les statuts HTTP appropriés : 200 pour une lecture, 201 pour une
création, 404 pour une ressource absente, etc. Pour retourner cette enveloppe
JSON, ne pas utiliser 204, car ce statut ne contient pas de corps.
Documenter également l'enveloppe réelle dans les schémas Swagger ;
l'interceptor ne met pas à jour automatiquement les annotations OpenAPI.
Le schéma Swagger actuel de `/api/health` décrit encore seulement son objet
interne `{ "status": "ok" }`.

#### Transmettre des valeurs de remplacement pour une erreur

Conserver `message` comme code de traduction et transmettre les valeurs à
remplacer dans `data`. Exemple depuis un contrôleur ou un service :

```ts
throw new NotFoundException({
  message: 'user_not_found',
  data: { userId: '123' },
});
```

La réponse HTTP 404 devient :

```json
{
  "success": false,
  "message": "user_not_found",
  "data": { "userId": "123" }
}
```

Côté frontend, la traduction `user_not_found` peut être
« L’utilisateur {userId} est introuvable. ». Le frontend remplace `{userId}`
par `data.userId`, pour afficher « L’utilisateur 123 est introuvable. ».
L'API transmet le code et les valeurs ; elle n'effectue pas la traduction.

Le filtre transmet `data` uniquement pour une erreur HTTP inférieure à 500
avec un code de message valide et un objet `data` non nul, qui n'est pas un
tableau. Sinon, `data` reste `{}`. Les erreurs serveur conservent toujours
`internal_server_error` et `data: {}`. Ces valeurs étant visibles par le client,
inclure uniquement les informations nécessaires à l'affichage.

#### Better Auth : circuit de réponse distinct

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

### Contrôleur temporaire de démonstration

`ResponseDemoController` expose des routes publiques sans accès à la base de
données pour observer l'interceptor et le filtre. Elles sont également visibles
dans Swagger sous « Démonstration temporaire des réponses ».

| Route GET | Statut | Message | Résultat |
| --------- | ------ | ------- | -------- |
| `/api/response-demo/success` | 200 | `demo_successful` | Objet utilisateur fictif |
| `/api/response-demo/default` | 200 | `request_successful` | Message sans décorateur |
| `/api/response-demo/list` | 200 | `demo_users_retrieved` | Liste de deux utilisateurs fictifs |
| `/api/response-demo/empty` | 200 | `demo_empty_result` | Retour `null` transformé en `{}` |
| `/api/response-demo/not-found` | 404 | `demo_user_not_found` | Erreur personnalisée |
| `/api/response-demo/not-found-with-data?userId=123` | 404 | `user_not_found` | Valeur de remplacement dans `data.userId` (123 par défaut) |
| `/api/response-demo/bad-request` | 400 | `bad_request` | Phrase remplacée par un code par défaut |
| `/api/response-demo/server-error` | 500 | `internal_server_error` | Détails masqués et journalisés côté serveur |

Exemple : `curl -i http://localhost:3001/api/response-demo/not-found`.
La route `server-error` produit volontairement une erreur dans les logs.
Pour retirer cette démonstration, supprimer
`apps/backend/src/response-demo.controller.ts` et retirer son import ainsi que
son entrée dans `controllers` de `AppModule`.

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

Better Auth expose `user.name`, stocké dans `firstname`, ainsi que `lastname`,
`phone`, `teamId` et `isAdmin`. `teamId` et `isAdmin` ne sont pas modifiables via
les entrées utilisateur Better Auth.

`AuthModule` exporte `AuthGuard` pour protéger les contrôleurs avec
`@UseGuards(AuthGuard)`. Le guard vérifie la session depuis les en-têtes de la
requête, renvoie une erreur 401 si elle est invalide et ajoute les données à
`request.session`. Il ne vérifie pas le rôle administrateur.

### Routes métier prévues

Aucun contrôleur utilisateurs, équipes ou départements n'est actuellement
implémenté. Les routes `/api/users` et `/api/users/:id` ne sont donc pas disponibles,
malgré l'existence des modèles Prisma correspondants.

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
