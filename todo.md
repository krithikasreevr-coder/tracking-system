# Project TODO

- [x] Define schema for role-aware users, classes, class enrollment, staff assignments, completion status, and separate student personal assignments.
- [x] Add database migration and apply the schema to the managed production database.
- [x] Implement server-side role enforcement and validated tRPC procedures for classes, enrollments, assignments, assignment status, and personal assignments.
- [x] Build staff command-console dashboard with assignment CRUD, class and student management, and completion visualization.
- [x] Build student terminal planner with assigned-work tracking, personal assignment CRUD, and due-state highlighting.
- [x] Apply the neon/glitch design system with clipped cards, accessible contrast, responsive layouts, and reduced-motion support.
- [x] Add user-focused empty, loading, error, and confirmation states for all interactive flows.
- [x] Write and run Vitest coverage for authorization, assignment targeting, completion state, and personal-assignment data separation.
- [ ] Verify the app visually on desktop and mobile, resolve console or network errors, and document setup and usage.
- [x] Document local setup, managed environment requirements, role workflows, and data boundaries in README.md.
- [ ] Confirm the complete staff-to-student workflow against the managed database after the sandbox database connection timeout clears.
- [ ] Save a release checkpoint containing the completed application and source code.
