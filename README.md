# Time Manager

Monorepo foundation for an employee time management application.

Developer onboarding and daily workflow: [Guide de démarrage](docs/GETTING_STARTED.md) (French).

## Architecture

A single Git repository contains independent applications in a **pnpm workspace**. **Turborepo** runs their development, build, lint, and test tasks and caches completed checks and build outputs. `packages/` is reserved for future shared configuration.

```text
Browser → Nginx → Next.js frontend
               → /api/* → NestJS REST API → Prisma → PostgreSQL
```

Next.js uses TypeScript, App Router, `src/`, and Sass/SCSS. NestJS uses TypeScript, ESLint, Prettier, Jest, and `@nestjs/config`. Prisma belongs exclusively to the backend. Nginx preserves the `/api` prefix when proxying requests. Docker Compose separates PostgreSQL, the migration runner, backend, frontend, and Nginx into containers. The application ports and database port bind to localhost; Nginx is the public entry point.

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
├── .github/workflows/ci.yml
├── .dockerignore
├── .env.example
├── .env.production.example
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

| Technology                               | Version                |
| ---------------------------------------- | ---------------------- |
| Turborepo                                | 2.11.7                 |
| Next.js                                  | 16.3.8                 |
| React                                    | 19.3.0                 |
| NestJS                                   | 12.1.2                 |
| NestJS Config / CLI                      | 12.0.1 / 12.0.8        |
| Prisma CLI / Client / PostgreSQL adapter | 7.10.0                 |
| TypeScript                               | 6.0.2                  |
| Sass                                     | 1.105.1                |
| ESLint                                   | 9.39.5                 |
| Prettier                                 | 3.9.9                  |
| Jest / ts-jest                           | 30.5.2 / 29.4.14       |
| PostgreSQL image                         | 18-bookworm            |
| Nginx image                              | 1.30 (stable branch)   |
| Node Docker image                        | 24-bookworm-slim (LTS) |

Application dependencies are pinned and the root lockfile is committed. Container tags track stable patches in their selected release branches. TypeScript 6 remains within the ESLint and Jest tooling peer ranges. ESLint 9 is retained because Next.js's React, accessibility, and import plugins do not yet support ESLint 10. Prisma 7.10.0 is the newest stable release selected at initialization; the registry's Prisma 8 `latest` tag is a release candidate and deliberately excluded.

## Installation and environment files

Run all commands from the repository root:

```sh
nvm install # optional, if using nvm; reads .nvmrc
npm install --global pnpm@12.9.1
cp .env.example .env
pnpm install
pnpm prisma:generate
```

Development and production settings are kept separate. `.env.example` contains local development values; copy it to `.env` for the default `docker compose up` stack and host-run tools. Copy `.env.production.example` to `.env.production` for production Compose. Replace all production placeholders, especially the database password and Better Auth secret. Both actual files are ignored by Git and excluded from Docker build contexts.

## Development

Start the full development stack in containers, with source changes watched by Next.js and NestJS:

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build --wait
```

The frontend is available at **http://localhost:3000**, the backend at **http://localhost:3001**, PostgreSQL at **127.0.0.1:5432**, and the Nginx entry point at **http://localhost:8080**. Only the Nginx port is bound to all interfaces; the other published ports are local-only. The database is migrated before the backend starts. If a port is occupied, change its corresponding `*_PORT` value in `.env`.

To run the applications directly on the host instead, start only PostgreSQL and use the root pnpm scripts:

```sh
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --wait database
pnpm dev
```

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
pnpm ci:verify
```

Individual builds through the root Turbo script:

```sh
pnpm build --filter=frontend
pnpm build --filter=backend
```

Backend Jest tests verify the API, while frontend Vitest tests exercise the shared Button and Card components. `pnpm test:cov` runs both suites and generates LCOV and Cobertura coverage reports, which CI archives.

Turbo development tasks are persistent and uncached. Builds depend on upstream workspace builds; output caches include `.next/` (excluding its internal cache) and `dist/`. The separate `test:cov` task caches reports in `coverage/`; plain tests cache their result without file outputs. Prisma generation is embedded in the backend build/dev/test scripts so a fresh checkout works without generated files in Git.

## Prisma

Run these commands from the repository root. The root scripts delegate to the backend workspace internally and use its Prisma configuration.

```sh
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:studio
```

The schema and initial migration are in `apps/backend/prisma/`. Compose applies pending migrations in a one-shot container before starting the backend. When running the backend on the host, run `pnpm prisma:migrate` with PostgreSQL available. Regenerate the client after schema changes; Prisma 7 no longer generates it automatically during migrations.

Prisma 7 stores `DATABASE_URL` in `prisma.config.ts`, and runtime connections use `@prisma/adapter-pg`. Client generation needs no running database or secret. The generated TypeScript uses CommonJS to match the NestJS compiler and stays inside the backend.

## Docker Compose and production

```sh
cp .env.production.example .env.production
docker compose --env-file .env.production -f docker-compose.yml config --quiet
docker compose --env-file .env.production -f docker-compose.yml up --build -d --wait
curl http://localhost:8080/api/health
docker compose logs -f
docker compose down
```

The base Compose file builds production images; adding `docker-compose.dev.yml` selects the development targets with hot reload. Both Dockerfiles have dedicated development and production build stages. PostgreSQL, the one-shot Prisma migration runner, backend, frontend, and Nginx each run in separate containers on a private Compose network. Health checks gate startup, and a named volume preserves PostgreSQL data.

Nginx exposes the configurable public port (`HTTP_PORT`, default **8080**) and forwards `/api/*` to NestJS and all other paths to Next.js. The frontend and backend are also individually reachable on localhost ports 3000 and 3001; PostgreSQL uses localhost port 5432. The application and database bindings are loopback-only; do not expose those ports publicly. Use `HTTP_BIND_ADDRESS` to control the proxy bind address. Compose constructs the backend's internal database URL using the service name `database`; `DATABASE_URL` in the development env file is for host-run Prisma tools only. Use URL-safe database credentials. `docker compose down` preserves database data.

## CI, Git workflow, and Vercel

The GitHub Actions workflow runs on every push to `dev` and `main` and on pull requests targeting either branch (including updates to a feature branch's open PR). Both branches run the same formatting checks, frontend and backend lint, frontend and backend tests with coverage, app builds, Docker development/production builds, SCA dependency auditing, and CodeQL SAST. Only a successful push to `main` additionally deploys the frontend to Vercel. A failed check blocks that deployment. Coverage is retained as a 14-day Actions artifact; GitHub Actions also retains step logs.

Use this branch flow:

1. Each developer branches from `dev` using a descriptive branch (for example `feature/<name>` or `fix/<name>`).
2. Open a pull request from that branch to `dev`; merge only after CI succeeds.
3. Open a pull request from `dev` to `main`; the workflow rejects other sources for PRs to `main`.
4. A successful push to `main` automatically deploys the frontend to Vercel.

Configure GitHub branch protection to require the CI quality, container, and security checks before merging to `dev` or `main`, disallow direct pushes, and require pull requests. GitHub does not store these repository protections in the source tree.

Vercel hosts the Next.js frontend. The NestJS API and PostgreSQL still need a reachable backend/database host. Configure `BACKEND_URL` (the public API origin) and any other frontend build/runtime variables in the Vercel project's Production Environment; the deployment workflow pulls them from Vercel before building. Configure the backend's `FRONTEND_URL` to the Vercel origin in the backend host. Add only these GitHub Actions secrets for deployment authentication: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`. Set the Vercel project root to `apps/frontend`. If a required Vercel credential is missing, deployment stops with an explicit error.

## Validation

`pnpm ci:verify` runs the CI/deployment files formatting check, lint, frontend/backend tests with coverage, and both app builds. CI also validates both Compose configurations and builds the development and production container images. The production dependency audit and static security analysis run as separate required-success CI jobs.
