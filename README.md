# Teakflow

Internal company workspace for daily work reporting, real-time chat, and Google Meet.

This is a **pnpm + Turborepo** monorepo. All product docs are in [`docs/`](docs/README.md): agent rules, spec, theme, and tasks.

## Docs

| File                             | What it is                           |
| -------------------------------- | ------------------------------------ |
| [docs/README.md](docs/README.md) | Index and required read order        |
| [docs/AGENTS.md](docs/AGENTS.md) | Stack, invariants, what not to build |
| [docs/spec.md](docs/spec.md)     | Full product specification           |
| [docs/THEME.md](docs/THEME.md)   | Quiet Desk UI                        |
| [docs/TASKS.md](docs/TASKS.md)   | Implementation tickets               |

Agents read that folder first. New docs go in `docs/`, not the repo root.

## Apps

| App | Path       | Dev URL               |
| --- | ---------- | --------------------- |
| Web | `apps/web` | http://localhost:5173 |
| API | `apps/api` | http://localhost:3005 |

## Packages

| Package                              | Path                         |
| ------------------------------------ | ---------------------------- |
| Shared types, constants, Zod schemas | `packages/shared`            |
| TypeScript configs                   | `packages/typescript-config` |
| ESLint configs                       | `packages/eslint-config`     |

## Storage

All durable data lives in **Supabase**:

- **Postgres** — users, daily work, chat, meetings, notifications, audit logs (Sequelize over `DATABASE_URL`)
- **Storage** — employee avatars in the `avatars` bucket

Redis is local (Docker) and only used for Socket.IO presence / pub-sub later. It is not the source of truth.

Copy `.env.example` into `apps/api/.env` and `apps/web/.env`, then paste keys from the Supabase dashboard:

1. **Database → Connection string** (Session pooler, port 5432) → `DATABASE_URL`
2. **API → Project URL** → `SUPABASE_URL` / `VITE_SUPABASE_URL`
3. **API → anon public** → `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY`
4. **API → service_role** → `SUPABASE_SERVICE_ROLE_KEY` (API only)

## Setup

```bash
pnpm install
cp .env.example apps/api/.env   # then fill Supabase secrets
cp .env.example apps/web/.env   # then fill VITE_SUPABASE_* only
pnpm redis:up
pnpm dev
```

## Scripts

```bash
pnpm dev          # turbo: web + api
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm redis:up
pnpm redis:down
pnpm kill:ports    # free frontend :5173 and backend :3005
pnpm kill:web      # frontend only
pnpm kill:api      # backend only
```

## Product focus

Daily work after the workday, team chat, and Google Meet. Do not turn this into Jira, a sprint tracker, or an employee-surveillance tool.
