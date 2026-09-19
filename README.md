<p align="center">
  <img src="apps/web/public/brand/codeteak-logo.svg" alt="Codeteak" width="96" height="96" />
</p>

<h1 align="center">Teakflow</h1>

<p align="center">
  <strong>Codeteak</strong> internal workspace<br />
  Daily work · Real-time chat · Google Meet
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Codeteak-Teakflow-FC4903?style=flat-square&labelColor=1B1A17" alt="Codeteak Teakflow" />
  <img src="https://img.shields.io/badge/UI-Quiet%20Desk-F4F1EB?style=flat-square&labelColor=1B1A17&color=6F6B64" alt="Quiet Desk" />
  <img src="https://img.shields.io/badge/Node-≥22.13-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node" />
  <img src="https://img.shields.io/badge/pnpm-11-F69220?style=flat-square&logo=pnpm&logoColor=white" alt="pnpm" />
</p>

---

## What it is

**Teakflow** is Codeteak’s calm internal product for the end of the day — not a project board, not a CRM, not surveillance.

People write what they shipped, talk to the team in real time, and start Google Meet from one place.

| Principle | Meaning |
| :-- | :-- |
| **Accountability** | One daily notebook per person, per work date |
| **Communication** | DMs, groups, channels — membership only |
| **Meetings** | Google Meet via Calendar — no custom video stack |
| **Quiet Desk** | Paper UI, one accent `#FC4903`, no dashboard noise |

---

## Features

### Daily work

| | |
| :-- | :-- |
| **Evening window** | Submissions open only in the configured company window (server time, never the browser clock) |
| **Notebook** | Write what you worked on — headings, lists, emphasis; paste/cut discouraged on purpose |
| **Same-day edit** | After submit, your own notebook stays editable for that work date; past days lock |
| **Work / Plan** | Work is the submitted notebook; Plan is tomorrow’s intent — never copy-from-yesterday |
| **Team view** | Admin / Manager / Lead read notebooks in their reporting tree; employees see only their own |
| **Reminders** | Optional notify when the window opens and before it closes |

### Chat

| | |
| :-- | :-- |
| **Direct messages** | Search anyone and start a DM |
| **Groups & channels** | Public rooms follow company or reporting-tree rules; private rooms stay invite-only |
| **Realtime** | Socket.IO — persist first, then emit |
| **Threads & reactions** | Replies stay readable; reactions update live |
| **Mentions** | `@` autocomplete and mention notifications |
| **Search** | Meilisearch — text, people, typo tolerance; only conversations you belong to |
| **Presence** | Online, Away, Do not disturb |

### Meetings

| | |
| :-- | :-- |
| **Google Meet** | Create Calendar events with Meet links (company OAuth) |
| **Invites** | Scoped to Admin company-wide or Manager / Lead reporting tree |
| **Chat cards** | Meetings started from a conversation post back into the thread |
| **Reminders** | Created + ~15 minutes before start |

### Sales (Yaadro)

| | |
| :-- | :-- |
| **Field day** | Save visit, received payment, and fuel separately |
| **Daily work link** | Each visit appends onto that date’s notebook |
| **Shop directory** | Admin / Manager / Lead add, edit, delete, bulk upsert |
| **Payments** | Drive yearly workbook + Postgres ledger; executives edit allowed cells only |
| **CSV** | Preview the sheet first; download only after confirm |

### Admin & platform

| | |
| :-- | :-- |
| **People** | Create, edit, restrict / restore; roles, designations, reports-to |
| **Settings** | Company timezone, daily-work window, length, late, reminders |
| **Channels** | Company channel create / delete |
| **Audit logs** | Actions that matter for accountability |
| **PWA** | Installable app, offline GET cache, mobile bottom nav |
| **Hardening** | Rate limit, Helmet, CORS, Docker, CI |

---

## Who uses it

| Role | Access |
| :-- | :-- |
| **Admin** | Company-wide people, settings, channels, all daily work, Google connect, audit |
| **Manager** | Reporting tree (may head multiple departments); Team daily work; meetings in scope |
| **Lead** | Direct reports only; Team daily work and invites in that scope |
| **Employee** | Own daily work, chat, meetings they are invited to |

Job titles are **designations**, not extra logins.

---

## Stack

```text
apps/web          React 19 · Vite · Tailwind · Quiet Desk
apps/api          Node · Express · TypeScript · Sequelize · Socket.IO
packages/shared   Types · constants · Zod schemas
```

| Layer | Choice |
| :-- | :-- |
| Data | Supabase Postgres (`DATABASE_URL`) |
| Files | Cloudinary (avatars & chat attachments) |
| Realtime | Socket.IO (+ local Redis optional) |
| Search | Meilisearch (local, optional) |
| Meetings | Google Calendar / Meet OAuth |
| Tooling | pnpm · Turborepo · Vitest · Playwright · Docker |

---

## Quick start

**Requirements:** Node `≥22.13`, pnpm `11`, Docker (for Redis / Meilisearch).

```bash
pnpm install

cp .env.example .env
# Fill DATABASE_URL, Supabase, Cloudinary, JWT secrets
# Optional: apps/web/.env with VITE_* public keys only

pnpm redis:up          # Redis + Meilisearch
pnpm seed              # Demo company tree (password@1234)
pnpm dev               # Web :5173 · API :3005
```

| App | URL |
| :-- | :-- |
| Web | http://localhost:5173 |
| API | http://localhost:3005 · `/api/v1` |

Seeded logins use **`password@1234`** — e.g. `admin@codeteak.com`, `nisha@codeteak.com`, `asha@codeteak.com`.

---

## Scripts

| Command | Purpose |
| :-- | :-- |
| `pnpm dev` | Run web + API |
| `pnpm build` | Production build |
| `pnpm typecheck` | TypeScript across the monorepo |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest (API) |
| `pnpm seed` | Seed admin + demo reporting tree |
| `pnpm redis:up` / `pnpm redis:down` | Local Redis + Meilisearch |
| `pnpm kill:ports` | Free `:5173` and `:3005` |

---

## Documentation

Product truth lives in **`docs/`**. Agents and contributors read this order first:

| Document | Contents |
| :-- | :-- |
| [docs/README.md](docs/README.md) | Index |
| [docs/AGENTS.md](docs/AGENTS.md) | Stack, invariants, what not to build |
| [docs/spec.md](docs/spec.md) | Full product specification |
| [docs/THEME.md](docs/THEME.md) | Quiet Desk visual language |
| [docs/TASKS.md](docs/TASKS.md) | Implementation order |
| [docs/PRODUCT.md](docs/PRODUCT.md) | Status & vision (not the build contract) |
| [docs/SALES_DRIVE.md](docs/SALES_DRIVE.md) | Yaadro payment workbook setup |

---

## Repository layout

```text
Codeteak Work Progress/
├── apps/
│   ├── web/                 # Quiet Desk client
│   └── api/                 # Express API + sockets
├── packages/
│   ├── shared/              # Shared contracts
│   ├── typescript-config/
│   └── eslint-config/
├── docs/                    # Spec, tasks, theme, agents
└── .github/workflows/       # CI
```

---

## Design

**Quiet Desk** — warm paper (`#F4F1EB`), cream surfaces, charcoal type, one accent:

<p>
  <code style="background:#FC4903;color:#fff;padding:0.2rem 0.6rem;border-radius:4px;">#FC4903</code>
  &nbsp;Codeteak orange
</p>

Typography: **Plus Jakarta Sans** · **IBM Plex Mono** for dates and clocks.  
Motion stays short (~160ms). No gradients, no heavy shadows, no analytics wallpaper on Home.

---

## What we will not add

- Issue tracking, sprints, Gantt, kanban, productivity scores  
- Mouse / keyboard tracking, screenshots, webcam, keystroke logging  
- Copy-from-yesterday on daily work  
- A custom video conferencing stack  

---

<p align="center">
  <img src="apps/web/public/brand/codeteak-logo.svg" alt="Codeteak" width="40" height="40" />
  <br />
  <sub>Built for Codeteak · Teakflow</sub>
</p>
