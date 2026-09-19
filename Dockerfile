# Teakflow API — production image
# Postgres stays on Supabase. Redis/Meilisearch are optional sidecars (`pnpm redis:up`).

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/eslint-config/package.json packages/eslint-config/
RUN pnpm install --frozen-lockfile --filter @teakflow/api...

FROM deps AS build
COPY apps/api apps/api
COPY packages packages
RUN pnpm --filter @teakflow/api build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate \
  && apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /app /app
EXPOSE 3005
CMD ["pnpm", "--filter", "@teakflow/api", "start"]
