# Neon Classroom Tracker

Neon Classroom Tracker is a role-aware assignment management web application with separate staff and student workspaces. Staff use a command-console interface to create classes, enroll registered students, issue assignments, and inspect completion signals. Students use a terminal-style planner to manage assigned work alongside **separate private personal assignments**.

## Core capabilities

| Area | Implementation |
|---|---|
| Authentication | Email-and-password registration and login, with scrypt password hashing and a signed, HTTP-only session cookie. |
| Authorization | Every staff and student action is checked on the server. Students can only read and change their own work; staff can only operate on classes and students they manage. |
| Staff workspace | Class creation, email-based student enrollment, priority-aware assignment CRUD, completion matrix, deadline calendar, class analytics, at-risk learner signals, and CSV export. |
| Student workspace | Priority and due-date sorting, staff-work tracking, personal assignment CRUD, month/week calendar, reminder settings, and a client-side Pomodoro timer that persists completed focus sessions. |
| Persistence | Relational schema for users, enrollment, assignments, completion state, personal assignments, preferences, focus sessions, and reminder schedule metadata. |

## Roles and getting started

The first staff member should create a **Staff** account, create one or more classes, and then ask students to register **Student** accounts. In the Class Directory, staff enter a student’s exact registration email to enroll them. Once enrolled, that student can be targeted with an individual assignment or receive all work assigned to the class.

> Personal assignments use their own `personal_assignments` table and are never queried by staff workflows. This separation is enforced by the server and database model, rather than only by the interface.

## Local development

Install dependencies and start the application:

```bash
pnpm install
pnpm run dev
```

Run the static type check and automated tests:

```bash
pnpm exec tsc --noEmit
pnpm test
```

Generate a schema migration after changing `drizzle/schema.ts`:

```bash
pnpm drizzle-kit generate
```

Review the generated SQL and apply it through the managed database migration workflow. The priority, preferences, reminder-state, and focus-session migration is stored in `drizzle/0001_ambitious_the_hand.sql`.

## Environment

The managed project provides `DATABASE_URL` and `JWT_SECRET` at runtime. For an external or local installation, add a MySQL-compatible `DATABASE_URL` and a long random `JWT_SECRET` through the host’s secret-management interface. Never commit real credentials or a local environment file.

### Scheduled email reminders

The reminder worker is ready to send a configurable upcoming-deadline email and a one-time overdue email to opted-in students. It uses `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` as server-only secrets. The current SMTP login was rejected by the provider, so reminder delivery is **inactive until valid SMTP or app-password credentials are supplied and the live connectivity test passes**. The application never marks a reminder as sent until the provider accepts the email.

Students can change reminder opt-in and the lead-time window in the Settings tab. The schedule callback is designed for the managed periodic scheduler and is idempotent: delivery timestamps on `assignment_statuses` prevent duplicate due-soon and overdue notices.

## Design and accessibility

The application uses a dark neon operations design: cyan and magenta signals, deadline color coding, clipped console surfaces, a responsive layout, and an animated scanline layer. Motion and glow transitions are suppressed for users who enable **prefers-reduced-motion**.

## Validation

The project includes automated tests for password hashing, session-cookie safety, role gates, personal-assignment data separation, priority and reminder schema boundaries, and focus-session persistence. The external SMTP connectivity test runs only when `RUN_SMTP_LIVE_TEST=true`; it remains pending valid provider credentials. Priority levels, student settings, Pomodoro session logging, and staff analytics were also exercised through the live API using temporary records that were then removed.
