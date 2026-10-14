# Time Manager — Guide de démarrage

**Toutes les commandes ci-dessous se lancent à la racine du dépôt.**

## 1. Première installation

Prérequis : **Node.js 24.9+**, **pnpm 12.9.1**, Docker et Docker Compose v2.

Si vous utilisez nvm :

```bash
nvm install
```

Après avoir cloné le dépôt :

```bash
npm install --global pnpm@12.9.1 # si nécessaire
cp .env.example .env
pnpm install
pnpm prisma:generate
```

Les configurations de développement et de production sont distinctes. `.env` contient les valeurs de développement utilisées par le Compose par défaut et les outils lancés sur l'hôte ; `.env.production` est réservé au déploiement Compose. Ces deux fichiers sont ignorés par Git. Pour préparer la production : `cp .env.production.example .env.production`, puis remplacez tous les secrets d'exemple.

Si le port PostgreSQL **5432** est déjà occupé, modifiez **`POSTGRES_PORT` et le port dans `DATABASE_URL`** dans `.env`.

Le conteneur de migration applique les migrations existantes avant de lancer le backend Compose. Pour un backend lancé sur l'hôte, démarrez PostgreSQL avant `pnpm prisma:migrate`.

## 2. Lancer le projet au quotidien

### Développement local avec pnpm

C'est le mode conseillé : frontend, backend et base de données tournent dans des conteneurs distincts, avec rechargement à chaud des sources :

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build --wait
```

Le conteneur de migration applique les migrations avant le démarrage du backend. Pour utiliser plutôt les processus lancés depuis l'hôte :

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --wait database
pnpm dev
```

- Frontend : http://localhost:3000
- API de santé : http://localhost:3001/api/health
- Proxy inverse : http://localhost:8080 (entrée publique ; `/api/*` vers le backend, autres chemins vers le frontend)
- PostgreSQL : `127.0.0.1:5432`

Arrêtez les applications avec **Ctrl+C**.

### Stack complète avec Docker Compose

Pour faire tourner la stack de production locale (PostgreSQL, migration, backend, frontend et Nginx) :

```bash
cp .env.production.example .env.production
docker compose --env-file .env.production -f docker-compose.yml up --build -d --wait
```

Accès via le proxy public : **http://localhost:8080**, ou le port défini par `HTTP_PORT`. Frontend et backend sont également exposés sur leurs propres ports localhost (3000 et 3001) ; PostgreSQL sur 5432. Seul le proxy est lié par défaut à `0.0.0.0`.

Ce mode utilise les applications compilées. Relancez la commande après des changements de code pour reconstruire les images.

```bash
docker compose down
```

Cette commande arrête la stack et conserve les données PostgreSQL.

Pour revenir au développement local ou utiliser Prisma depuis votre machine, redémarrez la base avec la commande comprenant `docker-compose.dev.yml`.

## 3. Commandes importantes

| Commande                                                                               | Utilité                                                      |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `pnpm install`                                                                         | Installer ou mettre à jour les dépendances                   |
| `pnpm dev`                                                                             | Lancer frontend et backend en développement                  |
| `pnpm build`                                                                           | Compiler les deux applications                               |
| `pnpm test`                                                                            | Exécuter les tests disponibles, actuellement ceux du backend |
| `pnpm lint`                                                                            | Vérifier le code des deux applications                       |
| `pnpm ci:verify`                                                                       | Exécuter les contrôles CI locaux                             |
| `pnpm prisma:generate`                                                                 | Régénérer Prisma Client                                      |
| `pnpm prisma:migrate`                                                                  | Créer/appliquer les migrations de développement              |
| `pnpm prisma:studio`                                                                   | Ouvrir l'interface de consultation des données               |
| `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build --wait`     | Stack de développement complète                              |
| `docker compose --env-file .env.production -f docker-compose.yml up --build -d --wait` | Stack de production locale                                   |
| `docker compose down`                                                                  | Arrêter la stack sans supprimer les données                  |

## 4. Prisma et base de données

Le schéma se trouve dans **`apps/backend/prisma/schema.prisma`**.

- **`pnpm prisma:generate`** : à lancer après un changement du schéma pour mettre à jour Prisma Client. PostgreSQL n'a pas besoin de tourner. Les scripts backend de développement, build et test le lancent aussi automatiquement.
- **`pnpm prisma:migrate`** : à lancer lorsque vous modifiez les modèles ou récupérez de nouvelles migrations. **PostgreSQL doit être démarré.**
- **`pnpm prisma:studio`** : utile pour consulter les données et vérifier vos changements. **PostgreSQL doit être démarré.**

Après une modification des modèles :

```bash
pnpm prisma:migrate
pnpm prisma:generate
```

Ajoutez au commit le schéma modifié et les migrations créées dans **`apps/backend/prisma/migrations/`**.

## 5. Quand récupérer les changements des autres

Après :

```bash
git pull
```

Vérifiez les fichiers modifiés :

- **Un `package.json`, `pnpm-lock.yaml` ou `pnpm-workspace.yaml` a changé** → lancez `pnpm install`.
- **Le schéma Prisma a changé** → lancez `pnpm prisma:generate`. Si la structure de la base change, lancez d'abord `pnpm prisma:migrate`, avec PostgreSQL démarré.
- **De nouvelles migrations sont présentes** → lancez `pnpm prisma:migrate`, puis `pnpm prisma:generate`.
- **Seul le code applicatif a changé** → aucune installation supplémentaire n'est normalement nécessaire.

Ne recopiez pas `.env.example` sur `.env` à chaque pull. Si l'exemple évolue, reportez les nouvelles variables dans votre configuration locale.

## 6. Avant de push

```bash
pnpm ci:verify
```

Ce script vérifie le formatage des fichiers CI/déploiement, puis lance lint, tests avec couverture et build. `pnpm format:check` contrôle le dépôt entier ; ne formatez pas les fichiers sans rapport avec votre changement uniquement pour satisfaire ce contrôle. La pipeline GitHub Actions exécute aussi les builds Docker dev/prod, un audit SCA des dépendances de production (`pnpm audit --prod`) et un scan SAST CodeQL. Un échec bloque le job de déploiement ; les rapports de couverture sont conservés comme artefacts CI pendant 14 jours.

## 7. Workflow résumé

```bash
git pull
pnpm install          # si les dépendances ont changé

docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --wait database

pnpm prisma:migrate   # si des migrations doivent être appliquées/créées
pnpm prisma:generate  # si le schéma ou les migrations ont changé
pnpm dev
```

Avant de pousser :

```bash
pnpm ci:verify
git add <fichiers>
git commit -m "Description du changement"
git push
```

## 8. Workflow des branches et déploiement

Chaque développeur crée sa branche depuis `dev` (`feature/<nom>`, `fix/<nom>`), puis ouvre une pull request vers `dev`. Après validation, une pull request de `dev` vers `main` déclenche les mêmes contrôles. La pipeline refuse les pull requests vers `main` qui ne viennent pas de la branche `dev`. Configurez également les protections GitHub pour exiger les vérifications CI et interdire les pushs directs.

Les pushes vers `dev` et `main`, ainsi que les pull requests ciblant ces branches, exécutent les mêmes vérifications : tests backend et frontend avec couverture, lint, builds des applications et images Docker, audit SCA et scan SAST CodeQL. Le frontend a des tests Vitest sur les composants partagés Button et Card ; le backend a ses tests Jest. Aucun déploiement ne se produit depuis `dev`. Après un push validé sur `main`, le job supplémentaire publie le frontend sur Vercel.

Configurez le dossier racine du projet Vercel sur `apps/frontend` et définissez ses variables de production dans le tableau de bord Vercel, notamment `BACKEND_URL` (origine publique de l'API) et les autres variables de build nécessaires. La CI récupère ces variables auprès de Vercel. Ajoutez comme secrets GitHub uniquement `VERCEL_TOKEN`, `VERCEL_ORG_ID` et `VERCEL_PROJECT_ID`. Vercel n'héberge pas ici PostgreSQL ni le serveur NestJS : l'API doit être hébergée séparément, et son `FRONTEND_URL` doit autoriser l'origine Vercel.
