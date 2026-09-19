# Company Internal Work & Communication Platform

## 1. Project Overview

### Project Name
**Teakflow**

### Product Type
Internal employee daily-work tracking and team communication platform.

### Primary Goal

Build a focused internal application where employees can:

1. Record what they worked on each day.
2. Submit the daily work report only during a configured evening submission window.
3. Write the report themselves without copy/paste or importing previous content into the editor.
4. Once submitted, the daily work report becomes permanently read-only.
5. Chat with other employees in real time.
6. Mention employees using `@mentions`.
7. Use direct messages, group conversations, channels, replies/threads, reactions, typing indicators, read status, and notifications.
8. Create and join Google Meet meetings.
9. Allow managers/admins to view employee daily work submissions and submission status.

### Product Philosophy

This application is **not intended to replace Jira, Asana, Trello, or a full project-management platform**.

The product focuses on:

> **Daily Work Accountability + Internal Team Communication + Meetings**

Keep the application simple, fast, and easy for employees to use every day.

---

# 2. Core Modules

The MVP should contain only these primary modules:

```text
Home
Daily Work
Chat
Employees
Meetings
Notifications
Settings
```

Admin-specific functionality can additionally include:

```text
Employee Management
Daily Work Monitoring
Daily Work Settings
Chat/Channel Management
Meeting Management
Audit Logs
```

---

# 3. User Roles

## 3.1 Admin

Admin has company-wide access.

Admin can:

- Create employees.
- Edit employee information.
- Disable/activate employees (restrict login; restore later). Restricted people see: “You are restricted from company. contact admin or your manager for the access”. Any open session is signed out.
- Assign login roles: Admin, Manager, Lead, Employee.
- Assign reporting: Employee → Lead or Manager; Lead → Manager.
- Assign which departments a Manager **heads** (one Manager may head several, e.g. Engineering and Sales). Prefer one Manager as head of a given department.
- Assign extra job titles (designations) without extra logins.
- View all daily work submissions (today and previous days) for every employee.
- View pending submissions.
- Configure daily-work submission times.
- Configure the daily-work minimum length.
- Configure late submission rules.
- View employees.
- View all chat channels.
- Create/delete/manage company channels.
- View meetings.
- Manage application settings.
- View audit logs.

## 3.2 Manager

A Manager has **one login**. They may **head more than one department** (for example Development/Engineering and Sales). They do not get a second user for the second department.

Manager can:

- View their reporting tree: themselves, Leads who report to them, and Employees under those Leads or assigned directly to them.
- View daily work for that tree only, including previous days (read-only). They cannot copy an employee’s past notebook into a new entry. They do not see other managers’ teams, unassigned people, or company-wide lists.
- Filter/group Team daily work by headed department.
- Invite people in that tree to meetings.
- Use chat. Public groups they create include their tree.
- Create meetings.

A Manager cannot create employees, change assignments, open the Employees directory, or open daily work outside their tree.

## 3.3 Lead

Lead (including Asst. Manager as a **designation**) is a login role below Manager.

Lead can:

- View themselves and Employees assigned to them.
- View daily work (today and previous days, read-only) and invite meetings in that scope only. They do not see their manager’s other reports.
- Use chat. Public groups they create include their direct reports.

A Lead reports to one Manager. A Lead cannot change assignments or open the Employees directory.

## 3.4 Employee

Employee can:

- View their dashboard.
- Submit today's daily work during the allowed period.
- View their previous daily-work entries as read-only. They cannot open Team daily work for other people.
- Chat with employees.
- Participate in group conversations/channels.
- Mention employees.
- Reply to messages.
- React to messages.
- Receive notifications.
- Create/join Google Meet meetings if permitted.
- View employee profiles.

Login roles are only these four. Job titles such as Frontend Developer or Project Manager are **designations**, not extra login roles. Extra designations are additional titles on the same person.

---

# 4. Application Navigation

## Employee Navigation

```text
┌──────────────────────────────┐
│ Teakflow                     │
├──────────────────────────────┤
│ 🏠 Home                      │
│ 📝 Daily Work                │
│ 💬 Chat                      │
│ 📅 Meetings                  │
│                              │
│ 🔔 Notifications             │
│ ⚙ Settings                   │
└──────────────────────────────┘
```

## Admin Navigation

```text
Home
Daily Work
Chat
Employees
Meetings
Notifications
────────────────
Admin
  Employees
  Daily Work Settings
  Channels
  Audit Logs
  Settings
```

---

# 5. Authentication

## Login

Employees should log in using company credentials.

Initial MVP:

```text
Email
Password
```

Optional future authentication:

```text
Google Workspace SSO
Microsoft SSO
```

## Authentication Requirements

- Secure password hashing.
- Secure sessions or access/refresh tokens.
- Logout.
- Session expiration.
- Account activation/deactivation.
- Role-based authorization.
- Backend permission validation.

Never rely only on frontend role checks.

Every protected backend operation must verify that the authenticated user has permission to perform the action.

---

# 6. Home Dashboard

The home screen should provide a quick overview without becoming a large analytics dashboard.

Example:

```text
Good Evening, Alfayad 👋

September 11, 2026

────────────────────────────────

DAILY WORK

✅ Submitted

Submitted at 6:14 PM

[ View Today's Work ]

────────────────────────────────

CHAT

3 unread messages

[ Open Chat ]

────────────────────────────────

MEETINGS

Frontend Team
4:00 PM

[ Join Google Meet ]
```

Before the daily-work submission window opens:

```text
Today's Work

🔒 Submission opens at 6:00 PM.

You can submit your work after
the workday is completed.
```

---

# 7. Daily Work Module

This is the primary feature of the application.

The employee records a written summary of what they worked on during the day.

## 7.1 Daily Work Entry

Each employee gets exactly one daily-work entry per work date.

Example:

```text
Today's Work
September 11, 2026

What did you work on today?

┌────────────────────────────────────────┐
│                                        │
│ I worked on the Yaadro homepage hero   │
│ section and completed the responsive   │
│ mobile layout.                         │
│                                        │
└────────────────────────────────────────┘

Characters: 184 / 1000

[ Submit Work ]
```

The daily work main area has two tabs:

```text
Work | Plan
```

- **Work** is the submitted daily-work notebook (evening window, one entry per date).
- **Plan** is a separate page for what you intend to do. It is not yesterday’s report, not a project board, and does not copy Work.

---

# 8. Submission Time Restriction

The daily-work form must only become available during a configured submission window.

Default:

```text
Start: 6:00 PM
End: 11:59 PM
```

The times must be configurable by an administrator.

## Before 6 PM

The employee cannot submit.

Display:

```text
⏳ Daily work entry opens at 6:00 PM.

You can submit today's work after
the workday is completed.
```

## During Submission Window

Display:

```text
✅ Daily Work Entry Open

You can submit today's work.
```

## After Submission Window

If late submissions are disabled:

```text
The daily work submission window has closed.
```

If late submissions are enabled:

```text
⚠️ You missed today's submission window.

[ Submit Late ]
```

---

# 9. Server-Side Time Validation

Time restrictions must be enforced by the backend.

Do NOT trust the employee's browser clock.

Backend flow:

```text
Request
   ↓
Get server time
   ↓
Determine employee/company timezone
   ↓
Check submission window
   ↓
Allow / Reject submission
```

Store the actual server timestamp when the submission occurs.

Recommended timezone configuration:

```text
Asia/Kolkata
```

However, timezone should ideally be configurable at the company level.

---

# 10. Daily Work Content Rules

The daily-work field should be a simple text editor.

Recommended rules:

```text
Minimum characters: 50
Maximum characters: none (unlimited)
```

The minimum is configurable. There is no maximum length.

## Allowed

- Plain text and new lines.
- Notebook formatting: heading, description, bold, italic, underline, text color, lists.
- Normal keyboard typing.

## Do Not Provide

- Copy previous day's report.
- Import report.
- Templates containing previous work.
- Auto-filled text.
- File upload.
- Image upload.
- Report duplication.

---

# 11. Copy/Paste Restriction

The daily-work editor should discourage copy/paste.

Frontend controls:

- Prevent paste into the daily-work editor.
- Prevent cut.
- Prevent drag/drop text.
- Do not expose copy buttons.
- Do not show previous report text while composing.
- Do not provide "copy previous report".
- Do not pre-populate the editor.

Important:

> Browser-side restrictions cannot guarantee that a user will never copy information. These controls are workflow restrictions, not a security mechanism.

The system should focus on making genuine manual daily reporting the normal workflow.

---

# 12. Submission Lock

Once an employee submits the daily work:

```text
Status: 🔒 Submitted
```

The entry becomes read-only.

There must be:

- No Edit button.
- No Delete button.
- No Resubmit button.
- No Replace button.

Example:

```text
Today's Work

September 11, 2026

🔒 Submitted
Submitted at 6:14 PM

────────────────────────────

I worked on the Yaadro homepage hero
section and completed the responsive
mobile layout.

────────────────────────────

This entry cannot be edited after submission.
```

---

# 13. Database-Level Protection

The backend must also enforce the lock.

After `submitted_at` is set:

```text
UPDATE daily_work_entries
SET content = ...
```

must be rejected.

Do not depend only on hiding the Edit button in React.

The database/API layer must enforce immutability.

---

# 14. One Submission Per Employee Per Day

Database constraint:

```text
UNIQUE(user_id, work_date)
```

This ensures an employee cannot create multiple daily reports for the same date.

Example:

```text
Employee: 42
Work Date: 2026-09-11
```

Only one record can exist.

---

# 15. Daily Work History

Employees can see their previous submissions.

```text
Work History

September 11   🔒 Submitted
September 10   🔒 Submitted
September 09   🔒 Submitted
September 08   🔒 Submitted
```

Opening a previous entry displays it as read-only.

Example:

```text
September 10, 2026

🔒 Submitted at 6:18 PM

[Work content]

Read-only
```

Employees cannot modify historical entries.

---

# 16. Daily Work Admin/Manager View

Managers need a simple monitoring screen.

```text
Daily Work
September 11

Employees: 48

Submitted: 42
Pending: 6
Late: 2
```

Employee list:

```text
Employee        Status        Submitted

Alfayad         ✅ Submitted   6:14 PM
Rahul           ✅ Submitted   6:07 PM
Ahmed           🔴 Pending     -
John            ⚠️ Late        12:17 AM
```

Clicking an employee opens their read-only submission.

---

# 17. Daily Work Statuses

Recommended statuses:

```text
PENDING
SUBMITTED
LATE
MISSED
```

Suggested logic:

```text
Before window:
PENDING

Submitted during window:
SUBMITTED

Submitted after window:
LATE

Window closed with no submission:
MISSED
```

---

# 18. Daily Work Reminder

The system can notify employees when the submission window opens.

At 6 PM:

```text
🔔 Daily Work

Your daily work submission window is now open.

Please record what you worked on today.
```

Optional reminder:

```text
🔔 Reminder

You haven't submitted today's daily work yet.

Submission closes at 11:59 PM.
```

---

# 19. Chat Module

The second major module is real-time internal chat.

The chat should support:

```text
Direct Messages
Group Conversations
Channels
Mentions
Replies / Threads
Reactions
Typing Indicator
Online Status
Read Status
Notifications
Message Search
```

---

# 20. Chat Layout

Recommended desktop layout:

```text
┌────────────┬─────────────────────────────────┐
│            │                                 │
│ Search     │ Rahul                           │
│            │ ● Online                        │
│ Direct     │                                 │
│            │ Rahul:                          │
│ Rahul      │ Are you done with the UI?      │
│ Ahmed      │                                 │
│ John       │ You:                            │
│            │ Yes, almost completed.          │
│ Channels   │                                 │
│            │                                 │
│ #general   │                                 │
│ #frontend  │                                 │
│ #backend   │                                 │
│ #design    │                                 │
│            │─────────────────────────────────│
│            │ Message...              😊  ➤  │
└────────────┴─────────────────────────────────┘
```

---

# 21. Direct Messages

Employees can start one-to-one conversations.

Example:

```text
Alfayad
● Online

Message history

[message]

[message]

[message]

────────────────────
Write a message...
```

---

# 22. Group Conversations

Users can participate in group conversations.

Example:

```text
Frontend Team

Members:
Alfayad
Rahul
Ahmed
John
```

Group functionality:

- Group name.
- Group avatar/icon.
- Members.
- Add/remove members where permitted.
- Messages.
- Mentions.
- Reactions.
- Replies.
- Meeting link.

---

# 23. Channels

Channels are useful for company-wide team communication.

Initial channels:

```text
#general
#announcements
#frontend
#backend
#design
#qa
```

Channel types:

```text
PUBLIC
PRIVATE
```

Admin should control creation of company-wide channels.

Membership (industry-standard, same as Slack/Teams Workspace Admin):

- Direct messages, group chats, and channels appear in Chat only if the signed-in user is a member. That includes Admin. Admin is not a silent reader of other people’s DMs.
- Anyone can search people and start a DM.
- Admin **public** group/channel: everyone in the company, or one department if chosen. New employees and managers are added automatically.
- Manager or Lead **public** group: that person plus their reporting tree. Newly assigned reports are added automatically. If reports-to changes, they leave the old public groups.
- **Private** group/channel: only the selected members. New hires are not added automatically.
- Employees can create private groups only.
- Admin manages company channels from Channels (create/delete, member list) without opening private DMs they are not in. Public company rooms include Admin as a member, so those chats show in Admin’s inbox.

---

# 24. @Mentions

Employees must be able to mention other employees.

Example:

```text
@Alfayad can you check this?

@Rahul please review the API.
```

When mentioned:

```text
🔔 Rahul mentioned you in #frontend
```

Mention autocomplete:

```text
@al

Alfayad
Albin
Alex
```

Selecting a person inserts the mention.

---

# 25. Message Replies / Threads

Messages should support replies.

Example:

```text
Rahul:
The new UI is ready.

↳ 3 replies
```

Click:

```text
Main Message
────────────────────────

The new UI is ready.

Thread
────────────────────────

Alfayad:
Looks good.

Ahmed:
I'll test it.

Rahul:
Thanks 👍
```

This prevents channels from becoming difficult to follow.

---

# 26. Message Reactions

Employees can react to messages.

Initial reactions:

```text
👍
❤️
😂
🚀
👀
✅
```

Reaction counts should update in real time.

---

# 27. Typing Indicator

Display:

```text
Rahul is typing...
```

Use WebSockets.

Events:

```text
typing:start
typing:stop
```

Typing indicators should not be persisted as database messages.

---

# 28. Online / Offline Status

Employee status:

```text
🟢 Online
🟡 Away
🔴 Do Not Disturb
⚫ Offline
```

Connection defaults to Online / Offline. Users can set **Away** or **Do not disturb** from the sidebar while connected (`presence:set` → `user:presence`). DND still stores notifications but skips realtime push and sound until the user opens Notifications.

---

# 29. Read / Unread Messages

Chat should track whether the user has read messages.

Example:

```text
Rahul
3
```

where `3` means three unread messages.

When the conversation is opened, the system updates the read state.

---

# 30. Message Editing

Unlike daily work reports, chat messages can be edited.

Example:

```text
Message
"Please check the API."

Edited
```

Display:

```text
Please check the API. (edited)
```

Store:

```text
updated_at
```

---

# 31. Message Deletion

Users can delete their own messages.

Recommended behavior:

```text
This message was deleted.
```

Rather than physically deleting the database row.

Keep the message record for audit/history where appropriate.

---

# 32. Chat Search

Global chat search:

```text
🔍 Search messages
```

Example:

```text
Search: Yaadro

Results:

Rahul
"Yaadro API is ready."

Alfayad
"I completed the Yaadro hero."

Ahmed
"Yaadro deployment is scheduled."
```

Search should support:

- Message text.
- Sender.
- Channel/conversation.
- Date.
- Prefix autocomplete and suggestions as you type.
- Typo / spelling correction (Meilisearch typo tolerance).

Search uses Meilisearch on the API. Every role (Admin, Manager, Lead, Employee) can search. Results are limited to conversations the signed-in user is a member of, plus company people for starting a DM. Admin search is not a backdoor into other people’s private DMs.

Meilisearch is local (Docker), like Redis. The web app never talks to Meilisearch directly.

---

# 33. Notifications

Central notification system:

```text
🔔 Notifications

@Alfayad mentioned you
2 minutes ago

Rahul sent you a message
5 minutes ago

Frontend meeting starts in 15 minutes
10 minutes ago

Daily work submission is now open
6:00 PM
```

Notification types:

```text
MESSAGE
MENTION
REACTION
MEETING_CREATED
MEETING_REMINDER
DAILY_WORK_OPEN
DAILY_WORK_REMINDER
```

---

# 34. Google Meet Integration

Do not build your own video conferencing system for the MVP.

Use Google Meet.

The application should allow users to initialize/create a Google Meet meeting.

Example:

```text
Create Meeting

Title
Frontend Discussion

Participants
[ Alfayad ]
[ Rahul ]
[ Ahmed ]

Date
September 11

Start
4:00 PM

End
5:00 PM

[ Create Google Meet ]
```

The application stores the generated meeting information/link.

---

# 35. Meeting Screen

```text
Meetings

Frontend Discussion
Today · 4:00 PM

Participants
6

Google Meet
https://meet.google.com/...

[ Join Meeting ]
```

---

# 36. Meeting in Chat

A meeting can also appear as a chat event:

```text
📹 Alfayad created a meeting

Frontend Discussion

Today · 4:00 PM

[ Join Google Meet ]
```

This gives the team a direct place to access the meeting.

---

# 37. Google Integration Architecture

Potential flow:

```text
User
 ↓
Create Meeting
 ↓
Backend
 ↓
Google OAuth
 ↓
Google Calendar API
 ↓
Google Meet conference
 ↓
Meeting URL
 ↓
Save meeting in database
 ↓
Notify participants
```

Required Google integration should use OAuth and Google's official APIs.

Do not store Google passwords.

---

# 37b. Sales (Yaadro)

Sales department (and managers who head Sales) use **Sales** in Teakflow. Admin sees all Sales people. Manager/Lead see only their reporting tree. Executives see themselves.

Field day: save **one shop visit**, **one received payment**, and **fuel** separately (not one combined save). Fuel is **once per salesman per work date**: after the first save, it cannot be changed that day. Each saved visit appends that shop onto **that work date’s** daily-work notebook as a numbered heading (`1. shop name`), a meta line (time, place, type, ID), notes, then a separator line, in visit order.

Admin, Manager, and Lead maintain the shop directory: add, edit, delete, and bulk upsert with confirmation. Executives cannot change the directory. Bulk headers are `ID, SHOP NAME, PLACE` (any capitalization; extra payment columns ignored). Example: `docs/sales-shops-example.csv`.

Accounts files stay frozen: daily CSV headers including Issues/Updates; monthly payment workbook columns `ID, SHOP NAME, PLACE, AMOUNT, GST, STATUS, PAYMENT MODE, DATE, REFERNCE NO` (matched case-insensitively). Collection month is **previous** calendar month. Payment edits write the Drive sheet and Teakflow’s payment ledger (`sales_payment_ledger`). Daily received payments are stored in Postgres (`sales_payments_received` plus `sales_day_reports`). One Drive file per year named `monthly payment YYYY` in `sales / yaadro sales`. Setup: `docs/SALES_DRIVE.md`.

Executives pick a shop from the month tab and then see **that Excel row** (ID, name, place, amount, GST, status, mode, date, reference). They do not browse the workbook as a full table. They may change only STATUS, PAYMENT MODE, DATE, and REFERNCE NO. Admin, Manager, and Lead also see the full table, tree daily CSV, and shop-summary CSV. CSV download buttons open a sheet preview first; the file downloads only after **Download**.

Sales nav is for Admin, Manager, Lead, Sales department, and anyone who heads Sales.

---


Admin-only. Managers, leads, and employees do not get a company employee list. They see people through chat, meetings, and Team daily work (their reporting tree).

Simple directory grouped by department. Admin assigns reports-to from that department’s manager (who may head it) or lead.

```text
Employees

🔍 Search...

🟢 Alfayad
Frontend Developer

🟢 Rahul
Backend Developer

🟡 Ahmed
UI/UX Designer

⚫ John
QA Engineer
```

Employee profile:

```text
Alfayad

Frontend Developer
Engineering

● Online

[ Message ]
[ Create Meeting ]
```

---

# 39. Employee Profile Fields

Initial fields:

```text
id
name
email
avatar
designation
department
role
status
manager_id
headed_departments
extra_designations
created_at
last_seen_at
```

`role` is Admin, Manager, Lead, or Employee.

`headed_departments` is which departments a Manager heads (may be several). Prefer one Manager as head of a given department.

`extra_designations` is extra job titles on the same login.

`manager_id` is reports-to: Employee → Lead or Manager; Lead → Manager.

`designation` is the job title, chosen from:

```text
Administrator
Project Manager
Product Manager
Assistant Manager
Frontend Developer
Frontend Lead
Backend Developer
Backend Lead
Full Stack Developer
UI/UX Designer
Design Lead
QA Engineer
QA Lead
DevOps Engineer
```

`department` is chosen from:

```text
Engineering
Design
Product
QA
Operations
Sales
```

Do not expose unnecessary personal information.

---

# 40. Database Architecture

Recommended database:

**PostgreSQL**

ORM:

**Sequelize**

Core tables:

```text
users
roles
daily_work_entries

conversations
conversation_members
messages
message_reactions
message_reads

notifications

meetings
meeting_participants

channels
channel_members

audit_logs
```

---

# 41. Users Table

```text
users

id
name
email
password_hash
avatar
designation
department
role_id
manager_id
status
last_seen_at
created_at
updated_at
```

Status:

```text
ACTIVE
INACTIVE
```

---

# 42. Daily Work Table

```text
daily_work_entries

id
user_id
work_date
content
status
submitted_at
is_late
created_at
```

Important constraint:

```text
UNIQUE(user_id, work_date)
```

Once submitted, the backend must prevent content updates.

---

# 43. Conversations Table

```text
conversations

id
type
name
created_by
created_at
updated_at
```

Types:

```text
DIRECT
GROUP
CHANNEL
```

---

# 44. Conversation Members

```text
conversation_members

id
conversation_id
user_id
joined_at
last_read_message_id
```

---

# 45. Messages

```text
messages

id
conversation_id
sender_id
content
reply_to_message_id
created_at
updated_at
deleted_at
```

`reply_to_message_id` supports threads/replies.

---

# 46. Message Reactions

```text
message_reactions

id
message_id
user_id
reaction
created_at
```

Recommended constraint:

```text
UNIQUE(message_id, user_id, reaction)
```

---

# 47. Notifications

```text
notifications

id
user_id
type
title
message
reference_id
is_read
created_at
```

---

# 48. Meetings

```text
meetings

id
title
created_by
google_meet_url
google_event_id
start_time
end_time
created_at
updated_at
```

---

# 49. Meeting Participants

```text
meeting_participants

id
meeting_id
user_id
status
created_at
```

Possible status:

```text
INVITED
ACCEPTED
DECLINED
```

---

# 50. Audit Logs

Audit logs should record important system actions.

Example:

```text
audit_logs

id
user_id
action
entity_type
entity_id
metadata
created_at
```

Important actions:

```text
DAILY_WORK_SUBMITTED
EMPLOYEE_CREATED
EMPLOYEE_DISABLED
CHANNEL_CREATED
MESSAGE_DELETED
MEETING_CREATED
SETTINGS_UPDATED
```

Daily work content should not be silently changed through admin tools. If an exceptional administrative correction is ever required, it should be explicitly audited.

---

# 51. Backend Architecture

Recommended:

```text
Node.js
TypeScript
Express.js
PostgreSQL
Sequelize
Socket.IO
Redis
Meilisearch
```

Backend structure:

```text
src/

config/

controllers/
  auth/
  users/
  dailyWork/
  chat/
  channels/
  meetings/
  notifications/

services/
  auth/
  dailyWork/
  chat/
  google/
  notifications/

models/

routes/

middlewares/
  auth/
  authorization/
  validation/
  errorHandler/

sockets/
  chat/
  presence/
  notifications/

utils/

types/
```

---

# 52. REST API

Base URL:

```text
/api/v1
```

## Authentication

```text
POST /auth/login
POST /auth/logout
GET  /auth/me
```

## Users

```text
GET    /users
GET    /users/:id
POST   /users
PATCH  /users/:id
PATCH  /users/:id/status
```

## Daily Work

```text
GET  /daily-work/today
POST /daily-work
GET  /daily-work/history
GET  /daily-work/:id
GET  /daily-work/admin
GET  /daily-work/admin?date=YYYY-MM-DD
GET  /daily-work/user/:userId
GET  /daily-work/user/:userId?date=YYYY-MM-DD
GET  /daily-work/user/:userId/history
PATCH /daily-work/today
```

There should be no normal employee update endpoint after submission.

For example, do not expose:

```text
PATCH /daily-work/:id
```

unless it is specifically designed for a controlled administrative workflow.

## Chat

```text
GET    /conversations
POST   /conversations
GET    /conversations/:id
GET    /conversations/:id/messages
POST   /conversations/:id/messages
PATCH  /messages/:id
DELETE /messages/:id
POST   /messages/:id/reactions
DELETE /messages/:id/reactions
POST   /messages/:id/read
```

## Meetings

```text
GET  /meetings
POST /meetings
GET  /meetings/:id
POST /meetings/:id/join
```

## Notifications

```text
GET  /notifications
POST /notifications/:id/read
POST /notifications/read-all
```

---

# 53. WebSocket Architecture

Use Socket.IO.

Connection:

```text
Client
   ↓
Socket.IO
   ↓
Authentication
   ↓
Join user room
```

User room:

```text
user:{userId}
```

Conversation room:

```text
conversation:{conversationId}
```

Events:

```text
message:new
message:update
message:delete
message:reaction
message:read

typing:start
typing:stop

user:online
user:offline

notification:new
```

---

# 54. Chat Real-Time Flow

Example:

```text
Alfayad sends message
        ↓
Socket.IO
        ↓
Backend validates
        ↓
Save message in PostgreSQL
        ↓
Emit message:new
        ↓
Conversation members receive message
        ↓
Unread count updated
        ↓
Notification generated if required
```

Messages must be persisted in PostgreSQL before being considered successfully sent.

---

# 55. Frontend Architecture

Recommended:

```text
React
TypeScript
Vite
Tailwind CSS
shadcn/ui
TanStack Query
Zustand
Socket.IO Client
React Hook Form
Zod
```

Structure:

```text
src/

app/

components/
  ui/
  layout/
  common/
  chat/
  daily-work/
  meetings/
  employees/

pages/
  Home/
  DailyWork/
  Chat/
  Employees/
  Meetings/
  Notifications/
  Settings/

features/
  auth/
  dailyWork/
  chat/
  meetings/
  notifications/

services/
  api/
  socket/

store/

hooks/

types/

utils/
```

---

# 56. Daily Work Frontend States

The UI should have explicit states.

## Locked

```text
Submission not open
```

## Open

```text
User can type and submit
```

## Submitted

```text
Read-only
```

## Late

```text
Late submission
```

## Missed

```text
No submission
```

---

# 57. Daily Work UX

The user should not need to navigate through many screens.

Recommended flow:

```text
Home
 ↓
Today's Work
 ↓
Write
 ↓
Submit
 ↓
Locked
```

The application should clearly communicate why the form is unavailable.

---

# 58. Validation

Daily work:

```text
Required: Yes
Minimum: 50 characters
Maximum: none
```

Reject:

```text
Empty content
Whitespace-only content
Content below minimum
Submission outside allowed period
Duplicate daily entry
Submission after already submitted
```

---

# 59. Security Requirements

Because this is an internal company system:

- Password hashing.
- Secure authentication.
- RBAC.
- Input validation.
- Rate limiting.
- CORS configuration.
- Secure HTTP headers.
- SQL injection protection through ORM/query parameterization.
- XSS protection.
- Secure WebSocket authentication.
- Secure file handling if files are added later.
- Audit logs.
- Server-side permission validation.
- Server-side time validation.
- HTTPS in production.

---

# 60. Privacy

Do not build invasive employee-monitoring functionality.

The system should track:

- Work reports employees voluntarily submit.
- Chat activity.
- Meeting information.
- Application actions necessary for auditing.

Do not add:

- Mouse tracking.
- Keyboard tracking.
- Screenshots.
- Webcam monitoring.
- Hidden surveillance.
- Keystroke logging.

The goal is accountability through work reporting, not surveillance.

---

# 61. Responsive Design

The application should support:

```text
Desktop
Tablet
Mobile
```

Chat should be especially optimized for mobile.

Desktop:

```text
Sidebar
Conversation list
Chat window
```

Mobile:

```text
Conversation list
        ↓
Chat screen
        ↓
Back
```

Daily work should be extremely easy to submit from mobile.

---

# 62. UI Design Direction

The UI should be:

- Clean.
- Modern.
- Minimal.
- Professional.
- Fast.
- Not overloaded.
- Easy for employees to understand.

Avoid:

- Excessive charts.
- Large dashboards.
- Too many menu items.
- Complex project-management UI.
- Unnecessary animations.
- Excessive colors.

The daily-work screen should prioritize writing and submission.

The chat screen should prioritize communication.

---

# 63. Settings

## Employee Settings

```text
Profile
Password
Notifications
Theme
```

## Admin Settings

```text
Company Name
Timezone

Daily Work
  Start Time
  End Time
  Minimum Characters
  Allow Late Submission

Notifications
  Daily Work Reminder
  Meeting Reminder
  Mention Notifications
```

---

# 64. Daily Work Configuration

Example admin screen:

```text
Daily Work Settings

Submission Start
[ 06:00 PM ]

Submission End
[ 11:59 PM ]

Minimum Characters
[ 50 ]

Allow Late Submission
[ ✓ ]

Daily Reminder
[ ✓ ]

Reminder Time
[ 09:00 PM ]

[ Save Settings ]
```

---

# 65. Error Handling

Examples:

### Submission too early

```text
Daily work submission is not open yet.
It opens at 6:00 PM.
```

### Already submitted

```text
Today's daily work has already been submitted.
```

### Submission closed

```text
Today's submission window has closed.
```

### Invalid content

```text
Please enter at least 50 characters.
```

### Network error

```text
Unable to submit your work.
Please check your connection and try again.
```

Do not silently lose typed content during temporary network failures.

The notebook auto-saves a local draft while the employee types. Closing the notebook keeps the draft. Submit still sends the note to the server.

---

# 66. Important Edge Cases

The system must handle:

### Employee submits at 5:59:59 PM

Reject if the configured window has not opened.

### Employee submits at exactly 6:00 PM

Accept.

### Employee submits at 11:59 PM

Accept according to configured end-time semantics.

### Employee submits twice

Reject the second submission.

### User refreshes after submission

Show read-only submitted state.

### User changes browser clock

Backend still uses server time.

### User opens the form before 6 PM and waits until 6 PM

Revalidate submission time on submit.

### User loses internet during submission

Do not create a duplicate entry when they retry.

### Employee is disabled

They cannot log in or submit new work. Login shows: “You are restricted from company. contact admin or your manager for the access”. Open sessions are revoked. Admin can restore the account.

---

# 67. Testing Strategy

## Unit Tests

Use:

```text
Vitest
```

Test:

- Submission-window calculation.
- Character validation.
- Daily-work status.
- Late submission logic.
- Permission logic.
- Notification logic.

## Integration Tests

Test:

- Login.
- Daily work submission.
- Duplicate prevention.
- Submission lock.
- Chat APIs.
- Message reactions.
- Meeting creation.
- Notifications.

## E2E Tests

Use:

```text
Playwright
```

Important scenarios:

```text
Employee logs in
↓
Before 6 PM daily work is locked
↓
6 PM opens
↓
Employee writes work
↓
Submit
↓
Entry becomes read-only
↓
Employee cannot edit
```

Chat:

```text
Employee A sends message
↓
Employee B receives it live
↓
B replies
↓
A sees reply
↓
A mentions C
↓
C receives notification
```

Meeting:

```text
Create meeting
↓
Participants notified
↓
Google Meet link visible
↓
Participants can join
```

---

# 68. MVP Development Phases

## Phase 1 — Project Foundation

```text
React + TypeScript + Vite
Node + Express + TypeScript
PostgreSQL
Sequelize

Authentication
RBAC
Database setup
Base UI
```

## Phase 2 — Daily Work

```text
Daily work screen
Submission time rules
Server-side validation
Character limits
Submission
Locking
History
Admin/manager view
Reminders
```

## Phase 3 — Chat

```text
Direct messages
Group chats
Channels
Socket.IO
Typing
Presence
Read status
Mentions
Replies
Reactions
Notifications
Search
```

## Phase 4 — Meetings

```text
Google OAuth
Google Calendar integration
Google Meet creation
Meeting participants
Meeting notifications
Join links
Chat meeting events
```

## Phase 5 — Production Hardening

```text
Security
Rate limiting
Audit logs
Error handling
Performance
Unit tests
Integration tests
Playwright E2E tests
Docker
CI/CD
Production deployment
```

---

# 69. Suggested Project Timeline

A practical implementation sequence:

```text
Week 1
├── Architecture
├── Repository
├── Database
├── Authentication
└── RBAC

Week 2
├── Daily Work UI
├── Daily Work API
├── Time restrictions
├── Locking
└── History

Week 3
├── Admin Daily Work
├── Reminders
├── Employee directory
└── Notifications foundation

Week 4
├── Chat UI
├── Direct messages
├── Socket.IO
└── Message persistence

Week 5
├── Channels
├── Groups
├── Mentions
├── Replies
├── Reactions
└── Presence

Week 6
├── Google OAuth
├── Google Meet
├── Meetings
└── Meeting notifications

Week 7
├── Testing
├── Security
├── Audit logs
└── Performance

Week 8
├── Production deployment
├── Monitoring
├── Bug fixing
└── Final polish
```

---

# 70. Recommended MVP Feature Checklist

## Authentication

- [ ] Login
- [ ] Logout
- [ ] Current user
- [ ] Role-based access
- [ ] Employee activation/deactivation

## Daily Work

- [ ] Today's work
- [ ] Submission window
- [ ] Server-side time validation
- [ ] Minimum character validation
- [ ] Unlimited length (no maximum)
- [ ] Paste restriction
- [ ] No previous-report copy
- [ ] Submit
- [ ] Permanent read-only lock
- [ ] One entry per day
- [ ] History
- [ ] Late submission
- [ ] Missed status
- [ ] Admin/manager monitoring
- [ ] Reminders

## Chat

- [ ] Direct messages
- [ ] Group chat
- [ ] Channels
- [ ] Real-time messages
- [ ] Message editing
- [ ] Message deletion
- [ ] Replies
- [ ] Threads
- [ ] Reactions
- [ ] @mentions
- [ ] Typing indicator
- [ ] Online/offline
- [ ] Read/unread
- [ ] Message search
- [ ] Notifications

## Meetings

- [ ] Create meeting
- [ ] Google OAuth
- [ ] Google Meet link
- [ ] Participants
- [ ] Meeting list
- [ ] Join meeting
- [ ] Meeting notification
- [ ] Meeting event in chat

## Admin

- [ ] Employee management
- [ ] Daily work monitoring
- [ ] Daily work settings
- [ ] Channel management
- [ ] Notification settings
- [ ] Audit logs

---

# 71. Final Product Definition

The finished application should provide three primary experiences.

## A. Daily Work

```text
Employee works during the day
        ↓
6 PM
        ↓
Daily work opens
        ↓
Employee writes what they worked on
        ↓
Submit
        ↓
🔒 Permanently locked
        ↓
Manager can view
```

## B. Communication

```text
Employee
   ↓
Direct Chat
   ├── Messages
   ├── Replies
   ├── Reactions
   ├── Mentions
   └── Notifications

Team
   ↓
Channels
   ├── #general
   ├── #frontend
   ├── #backend
   └── #design
```

## C. Meetings

```text
Create Meeting
       ↓
Google Meet
       ↓
Invite employees
       ↓
Notification
       ↓
Join Meeting
```

---

# 72. Product Principle

The application should stay intentionally focused.

Do NOT add:

```text
❌ Jira-style issue tracking
❌ Complex project management
❌ Sprint management
❌ Gantt charts
❌ Employee screen monitoring
❌ Mouse tracking
❌ Time tracking surveillance
❌ Complex productivity scoring
```

Focus on:

```text
                    TEAKFLOW

              ┌───────────────────┐
              │    DAILY WORK     │
              │                   │
              │ Write → Submit    │
              │       → Lock      │
              └─────────┬─────────┘
                        │
              ┌─────────▼─────────┐
              │       CHAT        │
              │                   │
              │ DM • Channels     │
              │ Mentions • Threads│
              │ Reactions • Live  │
              └─────────┬─────────┘
                        │
              ┌─────────▼─────────┐
              │     MEETINGS      │
              │                   │
              │ Google Meet       │
              │ Create • Invite   │
              │ Join              │
              └───────────────────┘
```

**Core product statement:**

> **A simple internal company workspace where employees record their completed daily work after the workday, communicate with their team in real time, and start company meetings from one place.**
