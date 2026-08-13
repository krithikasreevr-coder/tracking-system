# Neon Classroom Tracker

Neon Classroom Tracker is a role-aware assignment management web application with separate staff and student workspaces. Staff use a command-console interface to create classes, enroll registered students, issue assignments, and inspect completion signals. Students use a terminal-style planner to manage assigned work alongside **separate private personal assignments**.

## Core capabilities

| Area | Implementation |
|---|---|
| Authentication | Email-and-password registration and login, with scrypt password hashing and a signed, HTTP-only session cookie. |
| Authorization | Every staff and student action is checked on the server. Students can only read and change their own work; staff can only operate on classes and students they manage. |
| Staff workspace | Class creation, email-based student enrollment, assignment creation/editing/deletion, class or individual targeting, and a completion matrix. |
| Student workspace | Assigned-work status tracking, due-soon and overdue indicators, plus a separate personal-assignment CRUD flow. |
| Persistence | Relational database schema for users, classes, enrollment, assignments, assignment targets, completion status, and personal assignments. |

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

Review the generated SQL and apply it through the managed database migration workflow. The initial migration is stored in `drizzle/0000_uneven_pet_avengers.sql`.

## Environment

The managed project provides `DATABASE_URL` and `JWT_SECRET` at runtime. For an external or local installation, add a MySQL-compatible `DATABASE_URL` and a long random `JWT_SECRET` through the host’s secret-management interface. Never commit real credentials or a local environment file.

## Design and accessibility

The application uses a dark neon operations design: cyan and magenta signals, deadline color coding, clipped console surfaces, a responsive layout, and an animated scanline layer. Motion and glow transitions are suppressed for users who enable **prefers-reduced-motion**.

## Validation

The project includes automated tests for password hashing, session-cookie safety, role gate behavior, the distinct personal-assignment table, and logout behavior. The login interface was also checked at desktop and mobile widths.
