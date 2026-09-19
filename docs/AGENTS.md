# AGENTS.md

Teakflow is an internal company workspace: **daily work reporting + real-time chat + Google Meet**. It is not Jira, Asana, Trello, or a surveillance product.

This file is one of the docs in `docs/`. Read the whole `docs/` folder first. Then follow `docs/spec.md` for product behavior, `docs/TASKS.md` for order of work, and `docs/THEME.md` for UI.

## Repository

pnpm + Turborepo.

```text
apps/web          React 19, Vite, Tailwind CSS v4, React Router
apps/api          Node, Express, TypeScript, Sequelize, Socket.IO, Supabase
packages/shared   Types, constants, Zod schemas used by web and api
packages/typescript-config
packages/eslint-config
docs/             Product spec, tasks, theme, and agent rules
```

- Package manager: **pnpm**. Do not add package-lock.json or yarn.lock.
- Shared contracts belong in `packages/shared`. Do not duplicate enums or API shapes in both apps.
- API base path is `/api/v1`.
- Company timezone default is `Asia/Kolkata` and must be server-configurable.
- **Postgres is Supabase.** `DATABASE_URL` holds all app data. Files (avatars and chat attachments) go to Cloudinary. Do not add a local Postgres container.
- All project documentation stays in `docs/`. Do not add new markdown guides at the repo root except the short `AGENTS.md` bootstrap and `README.md`.

## Commands

```bash
pnpm install
pnpm dev
pnpm typecheck
pnpm lint
pnpm redis:up
pnpm seed
```

`pnpm redis:up` starts local Redis and Meilisearch.

## Product invariants

These are not optional polish. Backend must enforce them even if the UI is bypassed.

1. One daily-work entry per employee per work date: `UNIQUE(user_id, work_date)`.
2. Daily work is writable only inside the configured evening window, using **server time**, never the browser clock.
3. After submit, your own notebook stays editable for that work date (company timezone). Past days are locked. `PATCH /daily-work/today` only for your today entry.
4. Admin, Manager, and Lead may read previous daily-work notebooks for people in their reporting tree (Admin: everyone). Those views are read-only. Employees may open only their own history.
5. No copy-previous-report, templates, import, file upload, or prefilled editor on daily work. Sales visit notes are composed by the server from that day’s shop form (not from yesterday).
6. Frontend paste/cut/drop blocking is a workflow aid, not security. Still enforce minimum length, window, and lock on the server.
7. Disabled employees cannot log in or submit.
8. Never trust frontend role checks. Every protected route verifies the session and role (Admin, Manager, Lead, Employee).
9. Chat messages are persisted in Supabase Postgres before they are considered sent.
10. Typing indicators are ephemeral. Do not store them as messages.
11. Meetings use Google Calendar / Google Meet. Do not build in-app video.

## What not to add

- Issue tracking, sprints, Gantt charts, kanban boards, productivity scores
- Mouse/keyboard tracking, screenshots, webcam monitoring, keystroke logging
- Extra dashboard charts
- Copy-from-yesterday on daily work
- A custom video conferencing stack

## UI rules

Theme name: **Quiet Desk**. Details in `docs/THEME.md`.

- Simple, calm, fast. Large type, lots of space, one primary accent (`#FC4903`).
- No gradients, no heavy shadows, no decorative animations.
- Transitions stay at ~160ms. No bounce. No layout jump on load.
- Daily work UI is a writing surface, not a form wizard.
- Chat UI is a conversation surface, not a social feed.
- Home is a short status screen, not an analytics dashboard.

## Backend rules

- Stack: Express + TypeScript + **Supabase Postgres** + Sequelize + **Cloudinary** + Socket.IO + Redis + **Meilisearch** (local/optional, like Redis).
- Sequelize talks to Supabase over `DATABASE_URL` with SSL. Use the Session pooler (port 5432) or the direct connection. Never the transaction pooler (6543).
- File uploads go through the API using Cloudinary (`CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`). Never put those secrets in `apps/web`.
- Daily work content is text in Postgres. Do not store reports in Storage buckets.
- Password hashing on the server. Sessions or access/refresh tokens. HTTPS in production.
- Sequelize models and parameterized queries only. No string-built SQL.
- Socket.IO connections must authenticate before joining rooms `user:{id}` or `conversation:{id}`.
- Submission-window math, late/missed status, and RBAC live in services, then unit-tested with Vitest.
- Audit logs for: daily work submitted, employee created/disabled, channel created, message deleted, meeting created, settings updated, sales payment cell updates.
- Do not silently rewrite daily-work content through admin tools.
- Sales payment files stay on Drive as yearly Sheets named `monthly payment YYYY` (see `docs/SALES_DRIVE.md`). Do not invent extra Excel columns.

## Code style

- TypeScript strict. Prefer `import type` for type-only imports.
- Named exports. Keep files focused.
- Zod at the API boundary. React Hook Form + Zod on forms when those features are built.
- TanStack Query for server state, Zustand only for client session/UI state.
- shadcn-style primitives live in `apps/web/src/components/ui`. Do not introduce a second component library.

## Implementation order

Work from `docs/TASKS.md`. Finish Phase 1 before Daily Work. Finish Daily Work before Chat. Finish Chat before Meetings. Do not skip server-side time validation or the submission lock to “come back later.”
