# TASKS.md

Source of truth for implementation order. Check a box only when the behavior is real, not when a placeholder page exists.

UI shells in `apps/web` are preview-only until the matching API task is done.

---

## Phase 0 — Repository (done)

- [x] Turborepo + pnpm workspaces
- [x] `apps/web` Vite React app with Quiet Desk theme
- [x] `apps/api` Express bootstrap + health route
- [x] `packages/shared` types, constants, Zod schemas
- [x] Supabase Postgres + Storage clients (Redis remains local via Docker)
- [x] Docs in `docs/` (AGENTS, spec, THEME, TASKS) plus Cursor rules

---

## Phase 1 — Foundation

### WH-101 Auth

- [x] `POST /api/v1/auth/login` with bcrypt password verify
- [x] `POST /api/v1/auth/logout` and session/token invalidation
- [x] `GET /api/v1/auth/me`
- [x] Secure cookies or access/refresh tokens
- [x] Inactive users cannot authenticate
- [x] Wire login page to the API; remove the preview bypass

### WH-102 Database (Supabase)

- [x] Fill `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` from the Supabase project
- [x] Sequelize SSL connection to Supabase Postgres (session pooler or direct)
- [x] Models: users, roles, daily_work_entries, conversations, conversation_members, messages, message_reactions, notifications, meetings, meeting_participants, channels/conversation types, audit_logs, company_settings (reads via `last_read_message_id` on members)
- [x] `UNIQUE(user_id, work_date)` on daily work
- [x] Store avatars and chat files on Cloudinary (`CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`)
- [x] Seed admin `admin@codeteak.com` (full staff seed still later)
- [x] Keep Cloudinary secrets on the API only; the web app receives public file URLs

### WH-103 RBAC

- [x] Auth middleware reads the session on every protected route
- [x] Role middleware for Admin / Manager / Lead / Employee
- [x] Four-tier reporting: Employee → Lead or Manager; Lead → Manager; Manager may head multiple departments
- [x] Admin nav: Employees, Daily Work Settings, Channels, Audit Logs, Settings
- [x] Frontend hides admin routes; backend still rejects unauthorized calls

### WH-104 App shell

- [x] Replace preview user chip with `auth/me`
- [x] Route guards
- [x] Responsive sidebar / mobile nav
- [x] Empty, loading, and error states for each module

---

## Phase 2 — Daily Work

### WH-201 Employee today

- [x] `GET /daily-work/today` returns state: LOCKED, OPEN, SUBMITTED, LATE_AVAILABLE, MISSED
- [x] State uses server time + company timezone
- [x] Editor only mounts when state is OPEN or LATE_AVAILABLE
- [x] Character count and configurable minimum (no maximum)
- [x] Block paste, cut, and drop in the editor
- [x] Do not show yesterday’s report while composing
- [x] Work / Plan tabs on the daily work main area (`/daily-work`, `/daily-work/plan`)

### WH-202 Submit and lock

- [x] `POST /daily-work` validates window, length, whitespace, uniqueness
- [x] Store server `submitted_at`
- [x] Mark LATE when outside window if late is allowed; otherwise reject
- [x] After submit, entry stays editable for the rest of that work date (`SUBMITTED_EDITABLE`)
- [x] `PATCH /daily-work/today` for own today entry; past days locked
- [x] Model hook / service rejects updates for other users or past work dates
- [x] Typed content survives a failed network request (keep local draft until success)
- [x] Notebook auto-saves a local draft while typing

### WH-203 History

- [x] `GET /daily-work/history`
- [x] `GET /daily-work/:id` read-only
- [x] Employee can open only their own history

### WH-204 Manager / admin monitoring

- [x] `GET /daily-work/admin` counts: submitted, pending, late, missed
- [x] Row list with name, status, submitted time
- [x] `GET /daily-work/user/:userId` read-only for permitted managers/admins
- [x] `GET /daily-work/user/:userId/history` previous days for people in the reporting tree (admin, manager, lead)
- [x] `GET /daily-work/admin?date=` team status for a past work date
- [x] Team daily work UI: date navigation + previous notebooks in the person panel
- [x] Admin assigns employees to a manager or lead; manager daily-work view is the reporting tree; Lead sees their people

### WH-205 Settings and reminders

- [x] Admin can set start/end times for the daily-work submission window
- [x] Admin can set min/max chars, allow late, reminder time, timezone
- [x] Job/cron: notify when window opens
- [x] Optional reminder before close if not submitted

**Edge cases that must have tests:** 17:59:59 reject, 18:00:00 accept, double submit reject, browser clock ignored, form left open across window start still revalidates on submit, disabled user blocked.

---

## Phase 3 — Chat

### WH-301 Conversations

- [x] Direct messages, group conversations, public/private channels
- [x] `GET/POST /conversations` and membership rules
- [x] Default channels from shared constants
- [x] Admin creates/deletes company channels

### WH-302 Realtime messages

- [x] Socket.IO auth, `user:{id}` and `conversation:{id}` rooms
- [x] Persist message, then emit `message:new`
- [x] Edit (`updated_at`, show “edited”), soft delete (“This message was deleted”)
- [x] Replies/threads via `reply_to_message_id`
- [x] Reactions with `UNIQUE(message_id, user_id, reaction)`
- [x] Read receipts and unread badges
- [x] `typing:start` / `typing:stop` not persisted
- [x] Online/offline presence + Away / DND (sidebar + Settings)

### WH-303 Mentions, search, notifications

- [x] `@` autocomplete from conversation members
- [x] Mention notification
- [x] Message search by text, sender, conversation, date (Meilisearch: typo tolerance, autocomplete, people + membership-only messages)
- [x] Notification center + `notification:new`

---

## Phase 4 — Meetings

### WH-401 Google Meet

- [x] Google OAuth (no stored Google passwords)
- [x] Create Calendar event with Meet conference
- [x] Store `google_meet_url` and `google_event_id`
- [x] Invite participants, list meetings, join opens Meet
- [x] Notify participants
- [x] Post a meeting card into the related chat when created from a conversation

---

## Phase 5 — Hardening

### WH-501 Quality

- [x] Vitest: window math, validation, status, RBAC, notifications
- [x] Integration: login, submit, lock, duplicate, chat, reactions, meetings
- [x] Playwright: locked → open → write → submit → immutable; live DM; mention notification; join Meet link
- [x] Rate limit, helmet, CORS, audit logs, error mapping
- [x] Docker production image + CI (`typecheck`, `lint`, `test`)

---

## Phase 6 — Next features (unique)

Finish WH-104 before any ticket below. Mirror each ticket into `spec.md` before coding. Stay Quiet Desk: no Jira boards, no surveillance, no Home analytics charts.

### WH-601 Polish baseline

- [x] Empty, loading, and error states for every module (carry-over from WH-104)
- [x] Staff seed beyond `admin@codeteak.com` (demo company tree)
- [x] Away / DND presence (online/offline already exists)

### WH-602 Evening tree digest

Unique manager ritual — not a dashboard of charts.

- [ ] At window open (and optional reminder): Manager/Lead gets one notification summarizing their tree — submitted / pending / late / missed for today
- [ ] Tap opens Team daily work for that date
- [ ] No productivity scores, streaks, or rankings

### WH-603 Plan → morning intent

Makes Work / Plan feel like one product beat without copy-from-plan.

- [ ] Home shows today’s Plan (if any) as a short “Intent” line before the window opens
- [ ] Plan never auto-fills the Work notebook
- [ ] After submit, Intent clears or marks done for that work date

### WH-604 Thread → Meet

Fastest path from chat friction to a Google Meet.

- [ ] From a thread or conversation header: “Meet about this”
- [ ] Prefill title from thread context; invite visible participants in scope
- [ ] Create Meet + post the meeting card back into that conversation

### WH-605 Week tape (read-only)

Accountability you can skim — still not a project board.

- [ ] Manager/Lead/Admin: horizontal week strip for one person in the reporting tree
- [ ] Each day shows status + first line / heading of the notebook (read-only)
- [ ] Click a day opens the existing person panel notebook

### WH-606 Reports-to handoff note

Built for services teams when people move leads.

- [ ] When Admin changes `manager_id`, optional one-line handoff note (who / why)
- [ ] New Lead/Manager sees it once on Team daily work or Home
- [ ] Audited; never copies daily-work content

### WH-607 Sales route day (Yaadro)

Field day that stays outside a CRM.

- [ ] Executive picks shops for today from the directory; ordered visit list
- [ ] Completing a visit (existing save) checks it off the route
- [ ] Route does not invent pipeline, leads, or deal stages

### WH-608 Ship

- [ ] Production deploy runbook (env, Supabase, Cloudinary, Google OAuth, Sales SA)
- [ ] Health checks + basic error monitoring hook
- [ ] Final Quiet Desk pass: loading skeletons, empty copy, mobile chat polish

---

## Suggested week map

| Week | Focus                                                    |
| ---- | -------------------------------------------------------- |
| 1    | WH-101 to WH-104                                         |
| 2    | WH-201 to WH-203                                         |
| 3    | WH-204, WH-205, employee directory                       |
| 4    | WH-301, WH-302 DMs                                       |
| 5    | Channels, groups, mentions, threads, reactions, presence |
| 6    | WH-401                                                   |
| 7    | WH-501 tests and security                                |
| 8    | Deploy, monitor, polish                                  |
| 9    | WH-601 polish + WH-602 evening digest                    |
| 10   | WH-603 Plan intent + WH-604 Thread → Meet                |
| 11   | WH-605 week tape + WH-606 handoff                        |
| 12   | WH-607 sales route + WH-608 ship                         |

When you pick up work, implement the next unchecked task, keep the theme, and do not expand scope past that task.

## Sales (Yaadro)

- [x] Sales module in Teakflow: tree-scoped dashboard, visit + notes → daily work, frozen CSV headers
- [x] Payments read/update Drive workbook; previous month tab; one file per year in `sales / yaadro sales`
- [x] Admin / Manager / Lead shop directory: add, edit, delete, bulk upsert with confirm (`ID, SHOP NAME, PLACE`)
- [x] Connect `GOOGLE_SALES_SA_JSON` + folder (see `docs/SALES_DRIVE.md`)
- [x] Daily received + collection ledger in Postgres; own-report CSV for executives; full workbook only for admin/manager/lead
- [x] Save visit, received, and fuel separately; each visit appends to that date’s daily-work notebook
- [x] One fuel amount per salesman per work date (create once, then locked)
- [x] CSV downloads open a sheet preview; file saves only after Download
