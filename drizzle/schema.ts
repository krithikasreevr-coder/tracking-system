import {
  boolean,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
    role: mysqlEnum("role", ["staff", "student"]).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("users_email_unique").on(table.email)],
);

export const classes = mysqlTable("classes", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  staffId: int("staffId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const classStudents = mysqlTable(
  "class_students",
  {
    classId: int("classId").notNull().references(() => classes.id, { onDelete: "cascade" }),
    studentId: int("studentId").notNull().references(() => users.id, { onDelete: "cascade" }),
    enrolledAt: timestamp("enrolledAt").defaultNow().notNull(),
  },
  table => [primaryKey({ columns: [table.classId, table.studentId] })],
);

export const assignments = mysqlTable("assignments", {
  id: int("id").autoincrement().primaryKey(),
  subject: varchar("subject", { length: 120 }).notNull(),
  title: varchar("title", { length: 240 }).notNull(),
  description: text("description"),
  dueDate: timestamp("dueDate").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high"]).default("medium").notNull(),
  createdBy: int("createdBy").notNull().references(() => users.id, { onDelete: "cascade" }),
  classId: int("classId").references(() => classes.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const assignmentStudents = mysqlTable(
  "assignment_students",
  {
    assignmentId: int("assignmentId").notNull().references(() => assignments.id, { onDelete: "cascade" }),
    studentId: int("studentId").notNull().references(() => users.id, { onDelete: "cascade" }),
  },
  table => [primaryKey({ columns: [table.assignmentId, table.studentId] })],
);

export const assignmentStatuses = mysqlTable(
  "assignment_statuses",
  {
    id: int("id").autoincrement().primaryKey(),
    assignmentId: int("assignmentId").notNull().references(() => assignments.id, { onDelete: "cascade" }),
    studentId: int("studentId").notNull().references(() => users.id, { onDelete: "cascade" }),
    done: boolean("done").default(false).notNull(),
    completedAt: timestamp("completedAt"),
    dueSoonNotifiedAt: timestamp("dueSoonNotifiedAt"),
    overdueNotifiedAt: timestamp("overdueNotifiedAt"),
  },
  table => [uniqueIndex("assignment_status_unique").on(table.assignmentId, table.studentId)],
);

export const personalAssignments = mysqlTable("personal_assignments", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("studentId").notNull().references(() => users.id, { onDelete: "cascade" }),
  subject: varchar("subject", { length: 120 }).notNull(),
  title: varchar("title", { length: 240 }).notNull(),
  description: text("description"),
  dueDate: timestamp("dueDate").notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high"]).default("medium").notNull(),
  done: boolean("done").default(false).notNull(),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const studentPreferences = mysqlTable("student_preferences", {
  studentId: int("studentId").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  reminderOptIn: boolean("reminderOptIn").default(true).notNull(),
  reminderLeadHours: int("reminderLeadHours").default(24).notNull(),
  focusMinutes: int("focusMinutes").default(25).notNull(),
  shortBreakMinutes: int("shortBreakMinutes").default(5).notNull(),
  longBreakMinutes: int("longBreakMinutes").default(15).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const pomodoroSessions = mysqlTable("pomodoro_sessions", {
  id: int("id").autoincrement().primaryKey(),
  studentId: int("studentId").notNull().references(() => users.id, { onDelete: "cascade" }),
  assignmentId: int("assignmentId").references(() => assignments.id, { onDelete: "set null" }),
  durationMinutes: int("durationMinutes").notNull(),
  completedAt: timestamp("completedAt").defaultNow().notNull(),
});

export const reminderSchedules = mysqlTable("reminder_schedules", {
  id: int("id").autoincrement().primaryKey(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  createdBy: int("createdBy").references(() => users.id, { onDelete: "set null" }),
  cron: varchar("cron", { length: 64 }).default("0 0 * * * *").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type SessionUser = Omit<User, "passwordHash">;
export type InsertUser = typeof users.$inferInsert;
