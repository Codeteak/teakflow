# THEME.md

# Quiet Desk

Teakflow’s visual language: a calm internal tool that feels like paper on a desk, not a SaaS marketing site.

## Intent

Simple. Smooth. Quiet. Employees should open it every evening without thinking.

- Warm paper background, cream surfaces, charcoal type, one primary accent `#FC4903`
- No gradients, glassmorphism, neon, or heavy drop shadows
- Motion is only short color/opacity transitions (160ms, `cubic-bezier(0.22, 1, 0.36, 1)`)
- One primary action per screen

## Tokens

Defined in `apps/web/src/index.css`.

| Token      | Value     | Use                                       |
| ---------- | --------- | ----------------------------------------- |
| paper      | `#F4F1EB` | App background                            |
| surface    | `#FCFAF6` | Cards, fields, chat pane                  |
| ink        | `#1B1A17` | Headings and body                         |
| muted      | `#6F6B64` | Secondary text                            |
| line       | `#E6E1D8` | Borders, dividers                         |
| sage       | `#FC4903` | Primary actions, active nav, sent bubbles |
| sage-hover | `#E04103` | Primary button hover                      |
| sage-soft  | `#FFE6DC` | Active nav fill, success badges           |
| amber      | `#9A6B2F` | Waiting / late                            |
| rose       | `#A24B3D` | Pending / danger                          |

Radius: 8 / 12 / 18. Type: **Plus Jakarta Sans** for UI, **IBM Plex Mono** for dates and timestamps.

## Layout

- Desktop: 232px sidebar, content `max-w-4xl`, except Chat which is full height.
- Mobile: bottom nav for primary modules; chat is list → conversation → back.
- Page titles around `text-3xl font-semibold tracking-tight`.
- Cards: `border border-line bg-surface`, no shadow.

## Screen rules

**Home** — greeting, date, three status blocks (daily work, chat, next meeting). No charts.

**Daily work** — the page is the editor. Work / Plan tabs sit at the top of the main calendar. History is a simple list. After submit, read-only text and no edit/delete/resubmit controls.

**Chat** — conversation list + thread. Unread is a small primary-color count. Keep composer one line until needed.

**Meetings / Employees / Settings** — lists and short forms. Do not add extra widgets.

## Do not

- Add a second accent color “for fun”
- Animate page transitions with fade-slides
- Use Inter, purple, or large dashboard grids
- Put icons on every sentence
- Dark mode until settings explicitly asks for it (token slots can exist later)
