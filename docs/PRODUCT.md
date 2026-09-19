# PRODUCT.md

Status and vision for **Teakflow** at **Codeteak**. This file is not the implementation contract.

- Behavior to build: [`spec.md`](spec.md)
- Order of work: [`TASKS.md`](TASKS.md)
- UI: [`THEME.md`](THEME.md)

Do not implement anything in **Future vision** until it is added to `spec.md` and `TASKS.md`.

---

## Company and product

**Codeteak** is a tech **product and services** company. People ship software, design, QA, and client work. They need one quiet place to say what they did today, talk to the team, and start a meeting.

**Teakflow** is that internal workspace. It is not Jira, Asana, Trello, or a CRM.

Focus today:

> Daily work accountability + real-time chat + Google Meet

**Quiet Desk** UI: paper background, cream surfaces, one accent `#FC4903`.

**Stack:** pnpm + Turborepo. Web: React, Vite, Tailwind. API: Express, TypeScript, Sequelize, Socket.IO. Data: Supabase Postgres. Files: Cloudinary. Meetings: Google Calendar / Meet. Redis and Meilisearch optional/local.

---

## Who uses it

Four login **roles**. Job titles are **designations**, not extra logins. One Manager may **head several departments**.

| Role | Meaning |
| --- | --- |
| Admin | Company-wide: people, settings, channels, all daily work, meetings Google connect |
| Manager | One login; may head Engineering and Sales (etc.); Team daily work for their reporting tree |
| Lead | Team daily work for people assigned to them; reports to a Manager |
| Employee | Own daily work, chat, meetings they are invited to |

Inactive / restricted users cannot log in or submit. Admin can restore them. Open sessions are signed out.

---

## Modules

Aligned with spec §2. “Live” means the screen is wired to the API, not a placeholder.

| Module | Status |
| --- | --- |
| Home | Live — greeting, daily-work status, unread chat, meetings link |
| Daily Work | Live — month calendar, notebook write/read, editable same day after submit |
| Chat | Live — DMs, groups, channels, realtime |
| Sales | Live — Sales dept + managers/leads; visit notes on daily work; shop directory upsert; Drive payments (connect SA) |
| Meetings | Live — list, create Meet, join, notifications |
| Notifications | Live — center + socket `notification:new` |
| Settings | Live — profile photo, sign out, admin Google connect |
| Team daily work | Live — admin/manager/lead counts, date navigation, read-only today and previous notebooks in the reporting tree |
| Daily work settings | Live — window, length, late, reminder, timezone |
| Channels | Live — admin create/delete company channels |
| Audit logs | Live — admin list of company actions |
| PWA / mobile | Live extra — installable app, GET cache, bottom nav |

---

## Implemented now

From `TASKS.md` plus extras already in the app.

### Foundation

- Email/password login, cookies, logout, `auth/me`
- Inactive users blocked
- Roles enforced on the API
- Desktop sidebar; mobile bottom nav (Home, Daily Work, Chat, Sales, More — Meetings in More)
- Route guards

### People

- Admin creates people (name, email, password, role, designation, extra titles, department, reports-to, headed departments for Managers)
- Employee → Lead or Manager; Lead → Manager; one Manager may head several departments (prefer one head per department)
- Team daily work and meeting invites follow the reporting tree, not department auto-enroll
- Directory search; start a DM; create a meeting with that person

### Daily work

- Server time + company timezone; states LOCKED, OPEN, SUBMITTED, LATE_AVAILABLE, MISSED
- One entry per user per date; own notebook editable after submit for that work date; past days locked
- Paste/cut/drop blocked in the editor; local draft until submit succeeds
- Notebook: bullets, bold/italic, toolbar
- Work / Plan tabs at the top of the daily work main area
- History (own entries); Admin sees everyone; Manager sees their tree; Lead sees their people; grouped by department
- Admin window, min length, late, reminders when the window opens and before close

### Chat

- Direct messages, group chats, public/private channels; default channels
- Inbox is membership-only for Admin, Manager, Lead, and Employee (no admin overlay on personal DMs)
- Anyone can search people and start a DM
- Admin public rooms auto-include the company (or one department); manager/lead public rooms auto-include their reporting tree; private rooms stay invite-only
- New people are added to matching public rooms; reports-to changes update those rooms
- Socket.IO; persist then emit; edit; soft delete; threads; reactions
- Read receipts, unread badges, typing (not stored), online/offline
- Mentions, Meilisearch chat search (all roles, membership-only messages, people, suggestions, typo correction), notification center

### Meetings

- Admin connects one company Google account (OAuth, no Google passwords)
- Calendar event + Meet URL stored; invitees; join opens Meet
- Manager/Lead invite only people in their reporting tree; participant checkboxes; start/end shortcuts (today, tomorrow)
- `MEETING_CREATED` / 15-minute reminder; chat card when created from a conversation
- Audit `MEETING_CREATED` on the API

### Client extras

- PWA (manifest, service worker)
- Offline: cached GET responses, daily-work drafts; send/submit still need network

---

## Remaining on the current spec (near-term)

Build these only from `spec.md` / `TASKS.md`, not from the vision section below.

- Phase 6 next: WH-602 evening tree digest (then WH-603+)
- Production deploy / monitoring (WH-608)

WH-601 done: empty/loading/error states, expanded staff seed, Away/DND presence.

---

## Future vision (not in spec)

**Do not implement until `spec.md` and `TASKS.md` are updated.**

These ideas fit a product-and-services company. They are **not** current Teakflow tickets.

| Idea | One sentence |
| --- | --- |
| Sales pipeline / leads | Track inbound and outbound leads without turning Teakflow into a full CRM in this repo yet. |
| Clients / accounts | Company records for who we sell to and who we deliver for. |
| Proposals | Status of quotes and SOWs next to the people who own them. |
| Service delivery | Lightweight delivery status for retainers and projects — still not Jira. |
| Richer HR | Leave, payroll, or documents — beyond today’s directory. |
| Project boards | Only if spec explicitly allows them; AGENTS currently forbids kanban/sprints. |

---

## What we will not add

- Issue tracking, sprints, Gantt, kanban, productivity scores (unless spec changes)
- Mouse/keyboard tracking, screenshots, webcam, keystroke logging
- Extra dashboard charts on Home
- Copy-from-yesterday on daily work
- A custom video stack (Google Meet only)
