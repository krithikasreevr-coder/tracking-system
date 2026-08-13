import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  addStudentToClass,
  createClass,
  createPasswordSessionToken,
  createPasswordUser,
  createPersonalAssignment,
  createStaffAssignment,
  deleteClass,
  deletePersonalAssignment,
  deleteStaffAssignment,
  findStudentForEnrollment,
  findUserByEmail,
  hashPassword,
  listClassStudents,
  listPersonalAssignments,
  listStaffAssignments,
  listStaffClasses,
  listStaffStudents,
  listStudentAssignedAssignments,
  passwordSessionCookieOptions,
  removeStudentFromClass,
  SESSION_COOKIE,
  setPersonalAssignmentStatus,
  setStudentAssignmentStatus,
  updateClass,
  updatePersonalAssignment,
  updateStaffAssignment,
  verifyPassword,
} from "./db";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";

const passwordInput = z.string().min(8, "Password must be at least 8 characters.").max(128);
const assignmentInput = z.object({
  subject: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(2000).nullable().optional(),
  dueDate: z.number().int().positive(),
  classId: z.number().int().positive().nullable(),
  studentIds: z.array(z.number().int().positive()).max(250),
});
const personalAssignmentInput = z.object({
  subject: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(2000).nullable().optional(),
  dueDate: z.number().int().positive(),
});

export function ensureRole(actualRole: "staff" | "student", requiredRole: "staff" | "student") {
  if (actualRole !== requiredRole) throw new TRPCError({ code: "FORBIDDEN", message: `${requiredRole === "staff" ? "Staff" : "Student"} access is required for this action.` });
}

const staffProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  ensureRole(ctx.user.role, "staff");
  return next({ ctx });
});

const studentProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  ensureRole(ctx.user.role, "student");
  return next({ ctx });
});

function toTrpcError(error: unknown) {
  const message = error instanceof Error ? error.message : "An unexpected error occurred.";
  return new TRPCError({ code: "BAD_REQUEST", message });
}

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
    register: publicProcedure
      .input(z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(320), password: passwordInput, role: z.enum(["staff", "student"]) }))
      .mutation(async ({ ctx, input }) => {
        try {
          if (await findUserByEmail(input.email)) throw new Error("An account already exists for this email address.");
          const user = await createPasswordUser({ ...input, passwordHash: await hashPassword(input.password) });
          ctx.res.cookie(SESSION_COOKIE, await createPasswordSessionToken(user.id), passwordSessionCookieOptions(ctx.req));
          return user;
        } catch (error) {
          throw toTrpcError(error);
        }
      }),
    login: publicProcedure
      .input(z.object({ email: z.string().trim().email().max(320), password: passwordInput }))
      .mutation(async ({ ctx, input }) => {
        try {
          const user = await findUserByEmail(input.email);
          if (!user || !(await verifyPassword(input.password, user.passwordHash))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Email or password is incorrect." });
          const { passwordHash: _passwordHash, ...safeUser } = user;
          ctx.res.cookie(SESSION_COOKIE, await createPasswordSessionToken(user.id), passwordSessionCookieOptions(ctx.req));
          return safeUser;
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw toTrpcError(error);
        }
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(SESSION_COOKIE, { ...passwordSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  classes: router({
    list: staffProcedure.query(({ ctx }) => listStaffClasses(ctx.user.id)),
    create: staffProcedure.input(z.object({ name: z.string().trim().min(1).max(160) })).mutation(async ({ ctx, input }) => {
      try { return await createClass(ctx.user.id, input.name); } catch (error) { throw toTrpcError(error); }
    }),
    update: staffProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(1).max(160) })).mutation(async ({ ctx, input }) => {
      try { return await updateClass(ctx.user.id, input.id, input.name); } catch (error) { throw toTrpcError(error); }
    }),
    delete: staffProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try { await deleteClass(ctx.user.id, input.id); return { success: true }; } catch (error) { throw toTrpcError(error); }
    }),
    students: staffProcedure.input(z.object({ classId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      try { return await listClassStudents(ctx.user.id, input.classId); } catch (error) { throw toTrpcError(error); }
    }),
    findStudent: staffProcedure.input(z.object({ email: z.string().trim().email().max(320) })).query(async (_opts) => {
      try { return await findStudentForEnrollment(_opts.input.email); } catch (error) { throw toTrpcError(error); }
    }),
    addStudent: staffProcedure.input(z.object({ classId: z.number().int().positive(), studentId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try { await addStudentToClass(ctx.user.id, input.classId, input.studentId); return { success: true }; } catch (error) { throw toTrpcError(error); }
    }),
    removeStudent: staffProcedure.input(z.object({ classId: z.number().int().positive(), studentId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try { await removeStudentFromClass(ctx.user.id, input.classId, input.studentId); return { success: true }; } catch (error) { throw toTrpcError(error); }
    }),
  }),
  staff: router({
    students: staffProcedure.query(({ ctx }) => listStaffStudents(ctx.user.id)),
    assignments: staffProcedure.query(({ ctx }) => listStaffAssignments(ctx.user.id)),
    createAssignment: staffProcedure.input(assignmentInput).mutation(async ({ ctx, input }) => {
      try { return { id: await createStaffAssignment(ctx.user.id, input) }; } catch (error) { throw toTrpcError(error); }
    }),
    updateAssignment: staffProcedure.input(z.object({ id: z.number().int().positive(), assignment: assignmentInput })).mutation(async ({ ctx, input }) => {
      try { await updateStaffAssignment(ctx.user.id, input.id, input.assignment); return { success: true }; } catch (error) { throw toTrpcError(error); }
    }),
    deleteAssignment: staffProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try { await deleteStaffAssignment(ctx.user.id, input.id); return { success: true }; } catch (error) { throw toTrpcError(error); }
    }),
  }),
  student: router({
    assigned: studentProcedure.query(({ ctx }) => listStudentAssignedAssignments(ctx.user.id)),
    personal: studentProcedure.query(({ ctx }) => listPersonalAssignments(ctx.user.id)),
    setAssignedStatus: studentProcedure.input(z.object({ assignmentId: z.number().int().positive(), done: z.boolean() })).mutation(async ({ ctx, input }) => {
      try { await setStudentAssignmentStatus(ctx.user.id, input.assignmentId, input.done); return { success: true }; } catch (error) { throw toTrpcError(error); }
    }),
    createPersonal: studentProcedure.input(personalAssignmentInput).mutation(async ({ ctx, input }) => {
      try { await createPersonalAssignment(ctx.user.id, input); return { success: true }; } catch (error) { throw toTrpcError(error); }
    }),
    updatePersonal: studentProcedure.input(z.object({ id: z.number().int().positive(), assignment: personalAssignmentInput })).mutation(async ({ ctx, input }) => {
      try { await updatePersonalAssignment(ctx.user.id, input.id, input.assignment); return { success: true }; } catch (error) { throw toTrpcError(error); }
    }),
    setPersonalStatus: studentProcedure.input(z.object({ id: z.number().int().positive(), done: z.boolean() })).mutation(async ({ ctx, input }) => {
      try { await setPersonalAssignmentStatus(ctx.user.id, input.id, input.done); return { success: true }; } catch (error) { throw toTrpcError(error); }
    }),
    deletePersonal: studentProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try { await deletePersonalAssignment(ctx.user.id, input.id); return { success: true }; } catch (error) { throw toTrpcError(error); }
    }),
  }),
});

export type AppRouter = typeof appRouter;
