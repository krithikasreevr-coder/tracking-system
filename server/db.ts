import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { jwtVerify, SignJWT } from "jose";
import { parse } from "cookie";
import {
  assignments,
  assignmentStatuses,
  assignmentStudents,
  classes,
  classStudents,
  personalAssignments,
  pomodoroSessions,
  studentPreferences,
  type SessionUser,
  type User,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "neon_tracker_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;
const sessionKey = new TextEncoder().encode(ENV.cookieSecret || "local-development-secret");

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database connection is unavailable.");
  return db;
}

function publicUser(user: User): SessionUser {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

function userColumns() {
  return {
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
  };
}

export function passwordSessionCookieOptions(req: { protocol?: string; headers?: Record<string, unknown> }) {
  const forwardedProto = String(req.headers?.["x-forwarded-proto"] ?? "");
  const isSecure = req.protocol === "https" || forwardedProto.split(",")[0]?.trim() === "https";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isSecure,
    path: "/",
    maxAge: SESSION_DURATION_SECONDS * 1000,
  };
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, expected] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expectedBuffer = Buffer.from(expected, "hex");
  return expectedBuffer.length === derived.length && timingSafeEqual(expectedBuffer, derived);
}

export async function createPasswordSessionToken(userId: number) {
  return new SignJWT({ userId, sessionType: "password" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(sessionKey);
}

export async function getPasswordSessionUser(req: { headers: Record<string, unknown> }): Promise<SessionUser | null> {
  const rawCookie = String(req.headers.cookie ?? "");
  const token = parse(rawCookie)[SESSION_COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionKey);
    if (payload.sessionType !== "password" || typeof payload.userId !== "number") return null;
    const db = await requireDb();
    const rows = await db.select(userColumns()).from(users).where(eq(users.id, payload.userId)).limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export { SESSION_COOKIE };

export async function findUserByEmail(email: string) {
  const db = await requireDb();
  const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return rows[0] ?? null;
}

export async function createPasswordUser(input: { name: string; email: string; passwordHash: string; role: "staff" | "student" }) {
  const db = await requireDb();
  const result = await db.insert(users).values({
    name: input.name.trim(),
    email: input.email.toLowerCase().trim(),
    passwordHash: input.passwordHash,
    role: input.role,
  });
  const insertId = Number(result[0].insertId);
  const created = await db.select().from(users).where(eq(users.id, insertId)).limit(1);
  if (!created[0]) throw new Error("Could not create the user account.");
  return publicUser(created[0]);
}

export async function listStaffClasses(staffId: number) {
  const db = await requireDb();
  const result = await db.select().from(classes).where(eq(classes.staffId, staffId));
  return Promise.all(
    result.map(async classroom => {
      const enrolled = await db.select({ studentId: classStudents.studentId }).from(classStudents).where(eq(classStudents.classId, classroom.id));
      return { ...classroom, studentCount: enrolled.length };
    }),
  );
}

async function getOwnedClass(staffId: number, classId: number) {
  const db = await requireDb();
  const found = await db.select().from(classes).where(and(eq(classes.id, classId), eq(classes.staffId, staffId))).limit(1);
  if (!found[0]) throw new Error("Class not found or you do not have access to it.");
  return found[0];
}

export async function createClass(staffId: number, name: string) {
  const db = await requireDb();
  const result = await db.insert(classes).values({ staffId, name: name.trim() });
  const found = await db.select().from(classes).where(eq(classes.id, Number(result[0].insertId))).limit(1);
  return found[0];
}

export async function updateClass(staffId: number, classId: number, name: string) {
  const db = await requireDb();
  await getOwnedClass(staffId, classId);
  await db.update(classes).set({ name: name.trim() }).where(eq(classes.id, classId));
  return getOwnedClass(staffId, classId);
}

export async function deleteClass(staffId: number, classId: number) {
  const db = await requireDb();
  await getOwnedClass(staffId, classId);
  await db.delete(classes).where(eq(classes.id, classId));
}

export async function listClassStudents(staffId: number, classId: number) {
  const db = await requireDb();
  await getOwnedClass(staffId, classId);
  return db
    .select({ ...userColumns(), enrolledAt: classStudents.enrolledAt })
    .from(classStudents)
    .innerJoin(users, eq(classStudents.studentId, users.id))
    .where(eq(classStudents.classId, classId));
}

export async function addStudentToClass(staffId: number, classId: number, studentId: number) {
  const db = await requireDb();
  await getOwnedClass(staffId, classId);
  const student = await db.select(userColumns()).from(users).where(and(eq(users.id, studentId), eq(users.role, "student"))).limit(1);
  if (!student[0]) throw new Error("Only student accounts can be enrolled in a class.");
  await db.insert(classStudents).values({ classId, studentId }).onDuplicateKeyUpdate({ set: { enrolledAt: new Date() } });
}

export async function removeStudentFromClass(staffId: number, classId: number, studentId: number) {
  const db = await requireDb();
  await getOwnedClass(staffId, classId);
  await db.delete(classStudents).where(and(eq(classStudents.classId, classId), eq(classStudents.studentId, studentId)));
}

export async function listStaffStudents(staffId: number) {
  const db = await requireDb();
  const rows = await db
    .select(userColumns())
    .from(classStudents)
    .innerJoin(classes, eq(classStudents.classId, classes.id))
    .innerJoin(users, eq(classStudents.studentId, users.id))
    .where(and(eq(classes.staffId, staffId), eq(users.role, "student")));
  const byId: Record<number, (typeof rows)[number]> = {};
  rows.forEach(student => { byId[student.id] = student; });
  return Object.values(byId).sort((a, b) => a.name.localeCompare(b.name));
}

export async function findStudentForEnrollment(email: string) {
  const db = await requireDb();
  const rows = await db
    .select(userColumns())
    .from(users)
    .where(and(eq(users.email, email.toLowerCase().trim()), eq(users.role, "student")))
    .limit(1);
  return rows[0] ?? null;
}

async function getAssignmentTargetStudentIds(assignment: typeof assignments.$inferSelect) {
  const db = await requireDb();
  if (assignment.classId) {
    const rows = await db.select({ studentId: classStudents.studentId }).from(classStudents).where(eq(classStudents.classId, assignment.classId));
    return rows.map(row => row.studentId);
  }
  const rows = await db.select({ studentId: assignmentStudents.studentId }).from(assignmentStudents).where(eq(assignmentStudents.assignmentId, assignment.id));
  return rows.map(row => row.studentId);
}

async function assertOwnStudents(staffId: number, studentIds: number[]) {
  const roster = await listStaffStudents(staffId);
  const allowed = new Set(roster.map(student => student.id));
  if (studentIds.some(studentId => !allowed.has(studentId))) {
    throw new Error("Assignments can only be sent to students in your classes.");
  }
}

export type AssignmentInput = {
  subject: string;
  title: string;
  description?: string | null;
  dueDate: number;
  priority: "low" | "medium" | "high";
  classId: number | null;
  studentIds: number[];
};

export type PersonalAssignmentInput = {
  subject: string;
  title: string;
  description?: string | null;
  dueDate: number;
  priority: "low" | "medium" | "high";
};

/** Compatibility type for unused legacy OAuth routes retained by the base template. */
export type LegacyUser = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
};

export async function getUserByOpenId(_openId: string): Promise<LegacyUser | null> {
  return null;
}

export async function upsertUser(_input: {
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  lastSignedIn?: Date;
  role?: "user" | "admin";
}): Promise<void> {
  // Password authentication is the sole active login method for this application.
}

export function validateAssignmentTarget(input: AssignmentInput) {
  if ((input.classId !== null && input.studentIds.length > 0) || (input.classId === null && input.studentIds.length === 0)) {
    throw new Error("Choose one class or one or more individual students for the assignment.");
  }
}

export async function createStaffAssignment(staffId: number, input: AssignmentInput) {
  const db = await requireDb();
  validateAssignmentTarget(input);
  if (input.classId) await getOwnedClass(staffId, input.classId);
  if (!input.classId) await assertOwnStudents(staffId, input.studentIds);
  const result = await db.insert(assignments).values({
    subject: input.subject.trim(),
    title: input.title.trim(),
    description: input.description?.trim() || null,
    dueDate: new Date(input.dueDate),
    priority: input.priority,
    createdBy: staffId,
    classId: input.classId,
  });
  const assignmentId = Number(result[0].insertId);
  if (!input.classId) await db.insert(assignmentStudents).values(input.studentIds.map(studentId => ({ assignmentId, studentId })));
  return assignmentId;
}

export async function updateStaffAssignment(staffId: number, assignmentId: number, input: AssignmentInput) {
  const db = await requireDb();
  const existing = await db.select().from(assignments).where(and(eq(assignments.id, assignmentId), eq(assignments.createdBy, staffId))).limit(1);
  if (!existing[0]) throw new Error("Assignment not found or you do not have access to it.");
  validateAssignmentTarget(input);
  if (input.classId) await getOwnedClass(staffId, input.classId);
  if (!input.classId) await assertOwnStudents(staffId, input.studentIds);
  await db
    .update(assignments)
    .set({ subject: input.subject.trim(), title: input.title.trim(), description: input.description?.trim() || null, dueDate: new Date(input.dueDate), priority: input.priority, classId: input.classId })
    .where(eq(assignments.id, assignmentId));
  await db.delete(assignmentStudents).where(eq(assignmentStudents.assignmentId, assignmentId));
  if (!input.classId) await db.insert(assignmentStudents).values(input.studentIds.map(studentId => ({ assignmentId, studentId })));
}

export async function deleteStaffAssignment(staffId: number, assignmentId: number) {
  const db = await requireDb();
  const existing = await db.select({ id: assignments.id }).from(assignments).where(and(eq(assignments.id, assignmentId), eq(assignments.createdBy, staffId))).limit(1);
  if (!existing[0]) throw new Error("Assignment not found or you do not have access to it.");
  await db.delete(assignments).where(eq(assignments.id, assignmentId));
}

export async function listStaffAssignments(staffId: number) {
  const db = await requireDb();
  const rows = await db.select().from(assignments).where(eq(assignments.createdBy, staffId));
  const output = [];
  for (const assignment of rows) {
    const targetStudentIds = await getAssignmentTargetStudentIds(assignment);
    const statuses = targetStudentIds.length
      ? await db.select().from(assignmentStatuses).where(and(eq(assignmentStatuses.assignmentId, assignment.id), inArray(assignmentStatuses.studentId, targetStudentIds)))
      : [];
    const targetStudents = targetStudentIds.length
      ? await db.select(userColumns()).from(users).where(inArray(users.id, targetStudentIds))
      : [];
    const className = assignment.classId
      ? (await db.select({ name: classes.name }).from(classes).where(eq(classes.id, assignment.classId)).limit(1))[0]?.name ?? "Archived class"
      : null;
    const statusByStudent = new Map(statuses.map(status => [status.studentId, status]));
    output.push({
      ...assignment,
      className,
      targetStudents,
      completion: targetStudentIds.map(studentId => ({
        studentId,
        done: statusByStudent.get(studentId)?.done ?? false,
        completedAt: statusByStudent.get(studentId)?.completedAt ?? null,
      })),
      totalStudents: targetStudentIds.length,
      completedStudents: statuses.filter(status => status.done).length,
    });
  }
  return output.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

export async function listStudentAssignedAssignments(studentId: number) {
  const db = await requireDb();
  const memberships = await db.select({ classId: classStudents.classId }).from(classStudents).where(eq(classStudents.studentId, studentId));
  const classIds = memberships.map(membership => membership.classId);
  const fromClasses = classIds.length ? await db.select().from(assignments).where(inArray(assignments.classId, classIds)) : [];
  const direct = await db
    .select({ assignment: assignments })
    .from(assignmentStudents)
    .innerJoin(assignments, eq(assignmentStudents.assignmentId, assignments.id))
    .where(eq(assignmentStudents.studentId, studentId));
  const assignmentById: Record<number, (typeof fromClasses)[number]> = {};
  [...fromClasses, ...direct.map(row => row.assignment)].forEach(assignment => { assignmentById[assignment.id] = assignment; });
  const unique = Object.values(assignmentById);
  if (!unique.length) return [];
  const statuses = await db.select().from(assignmentStatuses).where(and(eq(assignmentStatuses.studentId, studentId), inArray(assignmentStatuses.assignmentId, unique.map(assignment => assignment.id))));
  const statusByAssignment = new Map(statuses.map(status => [status.assignmentId, status]));
  return unique
    .map(assignment => ({ ...assignment, done: statusByAssignment.get(assignment.id)?.done ?? false, completedAt: statusByAssignment.get(assignment.id)?.completedAt ?? null }))
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

export async function setStudentAssignmentStatus(studentId: number, assignmentId: number, done: boolean) {
  const db = await requireDb();
  const assigned = await listStudentAssignedAssignments(studentId);
  if (!assigned.some(assignment => assignment.id === assignmentId)) throw new Error("This assignment is not assigned to you.");
  await db.insert(assignmentStatuses).values({ assignmentId, studentId, done, completedAt: done ? new Date() : null }).onDuplicateKeyUpdate({ set: { done, completedAt: done ? new Date() : null } });
}

export async function listPersonalAssignments(studentId: number) {
  const db = await requireDb();
  const rows = await db.select().from(personalAssignments).where(eq(personalAssignments.studentId, studentId));
  return rows.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

export async function createPersonalAssignment(studentId: number, input: PersonalAssignmentInput) {
  const db = await requireDb();
  await db.insert(personalAssignments).values({ studentId, subject: input.subject.trim(), title: input.title.trim(), description: input.description?.trim() || null, dueDate: new Date(input.dueDate), priority: input.priority });
}

export async function updatePersonalAssignment(studentId: number, id: number, input: PersonalAssignmentInput) {
  const db = await requireDb();
  const found = await db.select({ id: personalAssignments.id }).from(personalAssignments).where(and(eq(personalAssignments.id, id), eq(personalAssignments.studentId, studentId))).limit(1);
  if (!found[0]) throw new Error("Personal assignment not found.");
  await db.update(personalAssignments).set({ subject: input.subject.trim(), title: input.title.trim(), description: input.description?.trim() || null, dueDate: new Date(input.dueDate), priority: input.priority }).where(eq(personalAssignments.id, id));
}

export async function setPersonalAssignmentStatus(studentId: number, id: number, done: boolean) {
  const db = await requireDb();
  const found = await db.select({ id: personalAssignments.id }).from(personalAssignments).where(and(eq(personalAssignments.id, id), eq(personalAssignments.studentId, studentId))).limit(1);
  if (!found[0]) throw new Error("Personal assignment not found.");
  await db.update(personalAssignments).set({ done, completedAt: done ? new Date() : null }).where(eq(personalAssignments.id, id));
}

export async function deletePersonalAssignment(studentId: number, id: number) {
  const db = await requireDb();
  const found = await db.select({ id: personalAssignments.id }).from(personalAssignments).where(and(eq(personalAssignments.id, id), eq(personalAssignments.studentId, studentId))).limit(1);
  if (!found[0]) throw new Error("Personal assignment not found.");
  await db.delete(personalAssignments).where(eq(personalAssignments.id, id));
}

export async function getStudentPreferences(studentId: number) {
  const db = await requireDb();
  const existing = await db.select().from(studentPreferences).where(eq(studentPreferences.studentId, studentId)).limit(1);
  if (existing[0]) return existing[0];
  await db.insert(studentPreferences).values({ studentId }).onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
  const created = await db.select().from(studentPreferences).where(eq(studentPreferences.studentId, studentId)).limit(1);
  if (!created[0]) throw new Error("Unable to initialize student preferences.");
  return created[0];
}

export async function updateStudentPreferences(studentId: number, input: {
  reminderOptIn: boolean;
  reminderLeadHours: number;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
}) {
  const db = await requireDb();
  await db.insert(studentPreferences).values({ studentId, ...input }).onDuplicateKeyUpdate({ set: { ...input, updatedAt: new Date() } });
  return getStudentPreferences(studentId);
}

export async function logPomodoroSession(studentId: number, input: { assignmentId: number | null; durationMinutes: number }) {
  const db = await requireDb();
  if (input.assignmentId !== null) {
    const assigned = await listStudentAssignedAssignments(studentId);
    if (!assigned.some(assignment => assignment.id === input.assignmentId)) throw new Error("You can only log focus time against your own assigned work.");
  }
  const result = await db.insert(pomodoroSessions).values({ studentId, assignmentId: input.assignmentId, durationMinutes: input.durationMinutes });
  return Number(result[0].insertId);
}

export async function listStudentPomodoroSessions(studentId: number) {
  const db = await requireDb();
  return db.select().from(pomodoroSessions).where(eq(pomodoroSessions.studentId, studentId));
}

export async function listStaffAnalytics(staffId: number) {
  const db = await requireDb();
  const [assignmentRows, roster] = await Promise.all([listStaffAssignments(staffId), listStaffStudents(staffId)]);
  const rosterIds = roster.map(student => student.id);
  const focusRows = rosterIds.length ? await db.select().from(pomodoroSessions).where(inArray(pomodoroSessions.studentId, rosterIds)) : [];
  const now = Date.now();
  const assignmentsOverview = assignmentRows.map(assignment => {
    const completionDates = assignment.completion.flatMap(status => status.completedAt ? [status.completedAt.getTime()] : []);
    const averageDaysToComplete = completionDates.length
      ? completionDates.reduce((sum, completedAt) => sum + (completedAt - assignment.createdAt.getTime()) / 86_400_000, 0) / completionDates.length
      : null;
    return {
      id: assignment.id,
      title: assignment.title,
      subject: assignment.subject,
      priority: assignment.priority,
      dueDate: assignment.dueDate,
      totalStudents: assignment.totalStudents,
      completedStudents: assignment.completedStudents,
      completionRate: assignment.totalStudents ? Math.round((assignment.completedStudents / assignment.totalStudents) * 100) : 0,
      averageDaysToComplete,
    };
  });
  const students = roster.map(student => {
    const relevant = assignmentRows.filter(assignment => assignment.targetStudents.some(target => target.id === student.id));
    const completion = relevant.flatMap(assignment => assignment.completion.filter(status => status.studentId === student.id));
    const completed = completion.filter(status => status.done).length;
    const overdue = relevant.filter(assignment => assignment.dueDate.getTime() < now && !completion.some(status => status.done)).length;
    const focusMinutes = focusRows.filter(session => session.studentId === student.id).reduce((sum, session) => sum + session.durationMinutes, 0);
    return {
      id: student.id,
      name: student.name,
      email: student.email,
      totalAssignments: relevant.length,
      completedAssignments: completed,
      completionRate: relevant.length ? Math.round((completed / relevant.length) * 100) : 0,
      overdueAssignments: overdue,
      focusMinutes,
      atRisk: overdue >= 3,
    };
  });
  const trendSeries = roster.map(student => ({ key: `student_${student.id}`, name: student.name }));
  const completionsByDay = new Map<string, Record<string, number>>();
  assignmentRows.forEach(assignment => assignment.completion.forEach(status => {
    if (!status.done || !status.completedAt) return;
    const date = status.completedAt.toISOString().slice(0, 10);
    const key = `student_${status.studentId}`;
    const bucket = completionsByDay.get(date) ?? {};
    bucket[key] = (bucket[key] ?? 0) + 1;
    completionsByDay.set(date, bucket);
  }));
  const running = Object.fromEntries(trendSeries.map(series => [series.key, 0])) as Record<string, number>;
  const completionTrend = Array.from(completionsByDay.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([date, bucket]) => {
    Object.entries(bucket).forEach(([key, value]) => { running[key] = (running[key] ?? 0) + Number(value); });
    return { date, ...running };
  });
  return { assignments: assignmentsOverview, students, trendSeries, completionTrend, focusMinutes: focusRows.reduce((sum, session) => sum + session.durationMinutes, 0) };
}

export type ReminderCandidate = {
  assignmentId: number;
  studentId: number;
  studentName: string;
  studentEmail: string;
  title: string;
  subject: string;
  dueDate: Date;
  kind: "dueSoon" | "overdue";
};

export async function listReminderCandidates(now = new Date()): Promise<ReminderCandidate[]> {
  const db = await requireDb();
  const students = await db.select(userColumns()).from(users).where(eq(users.role, "student"));
  const output: ReminderCandidate[] = [];
  for (const student of students) {
    if (!student.email) continue;
    const preference = await getStudentPreferences(student.id);
    if (!preference.reminderOptIn) continue;
    const assigned = await listStudentAssignedAssignments(student.id);
    for (const assignment of assigned) {
      if (assignment.done) continue;
      const status = (await db.select().from(assignmentStatuses).where(and(eq(assignmentStatuses.assignmentId, assignment.id), eq(assignmentStatuses.studentId, student.id))).limit(1))[0];
      const millisecondsUntilDue = assignment.dueDate.getTime() - now.getTime();
      const leadWindow = preference.reminderLeadHours * 3_600_000;
      const kind: ReminderCandidate["kind"] | null = millisecondsUntilDue < 0
        ? (status?.overdueNotifiedAt ? null : "overdue")
        : (millisecondsUntilDue <= leadWindow && !status?.dueSoonNotifiedAt ? "dueSoon" : null);
      if (kind) output.push({ assignmentId: assignment.id, studentId: student.id, studentName: student.name, studentEmail: student.email, title: assignment.title, subject: assignment.subject, dueDate: assignment.dueDate, kind });
    }
  }
  return output;
}

export async function markReminderSent(candidate: Pick<ReminderCandidate, "assignmentId" | "studentId" | "kind">) {
  const db = await requireDb();
  const now = new Date();
  const notificationField = candidate.kind === "dueSoon" ? { dueSoonNotifiedAt: now } : { overdueNotifiedAt: now };
  await db.insert(assignmentStatuses).values({ assignmentId: candidate.assignmentId, studentId: candidate.studentId, done: false, ...notificationField }).onDuplicateKeyUpdate({ set: notificationField });
}
