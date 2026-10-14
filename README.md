# Time Manager

Minimal development foundation for an employee time tracking application. No business models, authentication, or time tracking features are implemented.

Developer onboarding and daily workflow: [Guide de démarrage](docs/GETTING_STARTED.md) (French).

Backend reference: [Documentation du backend](docs/BACKEND_DOCUMENTATION.md),
including [Validation et erreurs](docs/VALIDATION_AND_ERRORS.md) (French).

## Architecture

A single Git repository contains independent applications in a **pnpm workspace**. **Turborepo** runs their development, build, lint, and test tasks and caches completed checks and build outputs. `packages/` is reserved for future shared configuration.

```text
Browser → Nginx → Next.js frontend
               → /api/* → NestJS REST API → Prisma → PostgreSQL
```

Next.js uses TypeScript, App Router, `src/`, and Sass/SCSS. NestJS uses TypeScript, ESLint, Prettier, Jest, and `@nestjs/config`. Prisma belongs exclusively to the backend. Nginx preserves the `/api` prefix when proxying requests. Docker Compose provides the application network and persistent database volume; only Nginx publishes a port in the base stack.

## Project structure

```text
.
├── apps/
│   ├── backend/
│   │   ├── prisma/schema.prisma
│   │   ├── src/
│   │   │   ├── prisma/{prisma.module,prisma.service}.ts
│   │   │   ├── app.controller.ts
│   │   │   ├── app.module.ts
│   │   │   ├── configure-app.ts
│   │   │   └── main.ts
│   │   ├── test/health.spec.ts
│   │   ├── Dockerfile
│   │   ├── eslint.config.mjs
│   │   ├── jest.config.cjs
│   │   ├── nest-cli.json
│   │   ├── package.json
│   │   ├── prisma.config.ts
│   │   ├── tsconfig.build.json
│   │   └── tsconfig.json
│   └── frontend/
│       ├── public/.gitkeep
│       ├── src/app/{globals.scss,page.module.scss,layout.tsx,page.tsx}
│       ├── Dockerfile
│       ├── eslint.config.mjs
│       ├── next-env.d.ts
│       ├── next.config.ts
│       ├── package.json
│       └── tsconfig.json
├── packages/.gitkeep
├── nginx/nginx.conf
├── .dockerignore
├── .env.example
├── .gitignore
├── .nvmrc
├── .prettierignore
├── .prettierrc.json
├── docker-compose.dev.yml
├── docker-compose.yml
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

Generated Prisma code (`apps/backend/src/generated/prisma/`), dependencies, and build outputs are ignored by Git and generated locally or during Docker builds.

## Prerequisites and versions

- Node.js **24 LTS**, version **24.9+** (`nvm use`). Jest needs this version to load NestJS 12’s ESM packages from the CommonJS backend. The test scripts enable Node’s VM module support as required by Jest.
- pnpm **12.9.1**, pinned in `package.json`.
- Docker Engine/Desktop and Docker Compose v2.

| Technology                               | Version                     |
| ---------------------------------------- | --------------------------- |
| Turborepo                                | 2.11.7                      |
| Next.js                                  | 16.3.8                      |
| React                                    | 19.3.0                      |
| NestJS                                   | 12.1.2                      |
| NestJS Config / CLI                      | 12.0.1 / 12.0.8             |
| Prisma CLI / Client / PostgreSQL adapter | 7.10.0                      |
| TypeScript                               | 6.0.2                       |
| Sass                                     | 1.105.1                     |
| ESLint                                   | 9.39.5                      |
| Prettier                                 | 3.9.9                       |
| Jest / ts-jest                           | 30.5.2 / 29.4.14            |
| PostgreSQL image                         | 18-alpine                   |
| Nginx image                              | 1.30-alpine (stable branch) |
| Node Docker image                        | 24-bookworm-slim (LTS)      |

Application dependencies are pinned and the root lockfile is committed. Container tags track stable patches in their selected release branches. TypeScript 6 remains within the ESLint and Jest tooling peer ranges. ESLint 9 is retained because Next.js's React, accessibility, and import plugins do not yet support ESLint 10. Prisma 7.10.0 is the newest stable release selected at initialization; the registry's Prisma 8 `latest` tag is a release candidate and deliberately excluded.

## Installation

Run all commands from the repository root:

```sh
nvm install # optional, if using nvm; reads .nvmrc
npm install --global pnpm@12.9.1
cp .env.example .env
pnpm install
pnpm prisma:generate
```

The root `.env` is the only environment file needed. Both NestJS and the Prisma CLI load it, and process environment variables take precedence. Example credentials are for local development; replace them for deployment. `.env` is ignored by Git and excluded from Docker build contexts.

## Development

Start PostgreSQL with the development override, which publishes it on **127.0.0.1 only**, then start both apps:

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --wait database
pnpm dev
```

If port 5432 is in use, change `POSTGRES_PORT` in `.env` and the port in `DATABASE_URL` together. When this repository was initialized on a host with port 5432 already occupied, its ignored local `.env` used port **54329**. The committed example keeps the conventional 5432 default.

Run one application through the root Turbo script when needed:

```sh
pnpm dev --filter=frontend
pnpm dev --filter=backend
```

The backend generates its Prisma client before development/build and connects to PostgreSQL at startup. Start the database before running it. Prisma disconnects when NestJS closes or receives a shutdown signal.

| URL                              | Purpose                                     |
| -------------------------------- | ------------------------------------------- |
| http://localhost:3000            | Host-run frontend                           |
| http://localhost:3001/api/health | Host-run backend; returns `{"status":"ok"}` |
| http://localhost:8080            | Docker Nginx entry point                    |
| http://localhost:8080/api/health | Backend through Docker Nginx                |

`HTTP_PORT` changes the Nginx entry port. The frontend displays only **Time Manager**; there are no API clients or browser calls to the backend yet.

## API documentation

Swagger UI is available at http://localhost:3001/api/docs when running the backend locally, or http://localhost:8080/api/docs through Docker Nginx. It lets you inspect and test the documented endpoints. The OpenAPI specification is also available at `/api/docs-json` (JSON) and `/api/docs-yaml` (YAML).

Documentation is generated from NestJS controllers using `@nestjs/swagger`. The current API exposes `GET /api/health`, with its response schema and example documented. When adding routes, use `@ApiTags()`, `@ApiOperation()`, and response decorators such as `@ApiOkResponse()`; document DTO fields with `@ApiProperty()` and parameters with `@ApiParam()` or `@ApiQuery()` as needed. See the [NestJS OpenAPI documentation](https://docs.nestjs.com/openapi/introduction).

## Build and checks

```sh
pnpm build
pnpm lint
pnpm test
pnpm test:cov
pnpm format:check
```

Individual builds through the root Turbo script:

```sh
pnpm build --filter=frontend
pnpm build --filter=backend
```

The Jest HTTP tests import `AppModule` and replace the database provider, verifying the health response and global prefix without requiring PostgreSQL. The frontend currently has no tests because it contains only a title page; `pnpm test` runs the backend suite. Coverage output includes LCOV and Cobertura for future CI. No GitHub Actions workflows are introduced yet.

Turbo development tasks are persistent and uncached. Builds depend on upstream workspace builds; output caches include `.next/` (excluding its internal cache) and `dist/`. The separate `test:cov` task caches reports in `coverage/`; plain tests cache their result without file outputs. Prisma generation is embedded in the backend build/dev/test scripts so a fresh checkout works without generated files in Git.

## Prisma

Run these commands from the repository root. The root scripts delegate to the backend workspace internally and use its Prisma configuration.

```sh
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:studio
```

The schema contains only a PostgreSQL datasource and a generator. **No migrations have been created or run.** Use `prisma:migrate` after adding approved models, and regenerate the client after schema changes; Prisma 7 no longer generates it automatically during migrations.

Prisma 7 stores `DATABASE_URL` in `prisma.config.ts`, and runtime connections use `@prisma/adapter-pg`. Client generation needs no running database or secret. The generated TypeScript uses CommonJS to match the NestJS compiler and stays inside the backend.

## Docker Compose

```sh
docker compose config --quiet
docker compose up --build -d --wait
curl http://localhost:8080/api/health
docker compose logs -f
docker compose down
```

If the development database is already running, `up` with the base file recreates it without its host port. Use the development override again when returning to `pnpm dev`.

Dockerfiles use multi-stage builds and non-root application runtimes. The frontend runs its Next.js standalone output; the backend deploys production dependencies and compiled NestJS output. Database health gates backend startup, and frontend/backend health gate Nginx startup. Backend, frontend, and database have no published ports in the base configuration. All communicate on the Compose `internal` bridge network.

Compose constructs the backend's internal database URL from `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD`, using host `database`. The root `DATABASE_URL` serves host development/Prisma tools and does not override the container hostname. Use URL-safe database credentials in Compose and URL-encode credentials in host URLs. The database volume is mounted at `/var/lib/postgresql`, as required by PostgreSQL 18's image layout. `docker compose down` preserves data.

This is a deployment foundation with HTTP locally. Configure deployment-specific TLS and secrets before public hosting. Database migrations and CI/security gates will be added with later project work.

## Initialization verification

Executed successfully with Node 24.21.0 and pnpm 12.9.1:

- Root dependency installation, including a frozen-lockfile reinstall; no peer dependency conflicts remain.
- Prisma client generation from the schema with no models.
- Frontend and backend ESLint checks, and root formatting checks.
- Backend Jest suite: 2 HTTP tests passed; LCOV and Cobertura reports generated.
- Separate frontend/backend builds and the root Turbo build; Turbo recognizes both apps.
- `pnpm dev`: both apps started, the frontend returned its title, and `/api/health` returned `{"status":"ok"}`.
- Real `PrismaModule` initialization, a PostgreSQL `SELECT 1` query, and application context shutdown.
- Base and development Compose validation, both Docker image builds, Nginx syntax validation, and full-stack startup with all four services healthy.
- Frontend and health requests through Nginx on port 8080; only Nginx publishes a port in the base stack.
- PostgreSQL's public schema contains zero tables; no business migrations or models were added.

Initialization fixes: pnpm 12 uses `allowBuilds` instead of the old dependency build allowlist; Next.js's plugins require ESLint 9; TypeScript 6 needs explicit Node/Jest ambient types; NestJS 12's ESM packages need Node 24.9+ and Jest's VM module flag; the Prisma CLI needs OpenSSL in its Docker build stage; an existing host service occupied PostgreSQL port 5432, so the ignored local `.env` uses 54329 for development. The host's existing default Node installation was preserved; verification used a checksum-verified Node 24.21.0 binary, and Docker uses Node 24 LTS.
