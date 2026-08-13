import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { assignments, assignmentStatuses, personalAssignments } from "../drizzle/schema";
import { hashPassword, passwordSessionCookieOptions, validateAssignmentTarget, verifyPassword } from "./db";
import { ensureRole } from "./routers";

describe("classroom security boundaries", () => {
  it("hashes passwords with a unique salt and rejects an incorrect password", async () => {
    const firstHash = await hashPassword("correct-horse-battery-staple");
    const secondHash = await hashPassword("correct-horse-battery-staple");

    expect(firstHash).not.toContain("correct-horse-battery-staple");
    expect(firstHash).not.toBe(secondHash);
    await expect(verifyPassword("correct-horse-battery-staple", firstHash)).resolves.toBe(true);
    await expect(verifyPassword("incorrect-password", firstHash)).resolves.toBe(false);
  });

  it("enforces role-specific server procedure access", () => {
    expect(() => ensureRole("staff", "staff")).not.toThrow();
    expect(() => ensureRole("student", "student")).not.toThrow();
    expect(() => ensureRole("student", "staff")).toThrow(/staff access/i);
    expect(() => ensureRole("staff", "student")).toThrow(/student access/i);
  });

  it("uses a distinct persistent table for personal assignments", () => {
    expect(getTableName(personalAssignments)).toBe("personal_assignments");
    expect(getTableName(personalAssignments)).not.toBe(getTableName(assignments));
    expect(personalAssignments.studentId.name).toBe("studentId");
  });

  it("requires exactly one assignment targeting mode", () => {
    const base = { subject: "Math", title: "Fractions", dueDate: Date.now() + 86_400_000, description: null };
    expect(() => validateAssignmentTarget({ ...base, classId: 4, studentIds: [] })).not.toThrow();
    expect(() => validateAssignmentTarget({ ...base, classId: null, studentIds: [7, 8] })).not.toThrow();
    expect(() => validateAssignmentTarget({ ...base, classId: null, studentIds: [] })).toThrow(/choose one class/i);
    expect(() => validateAssignmentTarget({ ...base, classId: 4, studentIds: [7] })).toThrow(/choose one class/i);
  });

  it("models assignment completion as a per-student persistent status record", () => {
    expect(getTableName(assignmentStatuses)).toBe("assignment_statuses");
    expect(assignmentStatuses.assignmentId.name).toBe("assignmentId");
    expect(assignmentStatuses.studentId.name).toBe("studentId");
    expect(assignmentStatuses.done.name).toBe("done");
    expect(assignmentStatuses.completedAt.name).toBe("completedAt");
  });

  it("marks password-session cookies as HTTP-only and same-site protected", () => {
    const options = passwordSessionCookieOptions({ protocol: "https", headers: {} });
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", secure: true, path: "/" });
  });
});
