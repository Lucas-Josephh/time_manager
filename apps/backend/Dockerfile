FROM node:24-bookworm-slim AS base
WORKDIR /workspace
RUN apt-get update && apt-get install --yes --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN npm install --global pnpm@12.9.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/package.json
RUN pnpm install --frozen-lockfile --filter backend

FROM base AS development
COPY apps/backend apps/backend
ENV NODE_ENV=development
EXPOSE 3001
CMD ["pnpm", "--filter", "backend", "dev"]

FROM base AS migration
COPY apps/backend apps/backend
CMD ["pnpm", "--filter", "backend", "exec", "prisma", "migrate", "deploy"]

FROM base AS build
COPY apps/backend apps/backend
RUN pnpm --filter backend build
RUN pnpm --filter backend deploy --prod /app

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]
