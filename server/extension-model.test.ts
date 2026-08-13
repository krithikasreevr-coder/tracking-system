import { describe, expect, it } from "vitest";
import { assignments, assignmentStatuses, personalAssignments, pomodoroSessions, studentPreferences } from "../drizzle/schema";

describe("priority, reminder, and focus persistence", () => {
  it("stores priority on staff and personal assignments independently", () => {
    expect(assignments.priority.name).toBe("priority");
    expect(personalAssignments.priority.name).toBe("priority");
    expect(assignments.priority.enumValues).toEqual(["low", "medium", "high"]);
    expect(personalAssignments.priority.enumValues).toEqual(["low", "medium", "high"]);
  });

  it("keeps reminder preferences per student and records each notification state separately", () => {
    expect(studentPreferences.studentId.name).toBe("studentId");
    expect(studentPreferences.reminderOptIn.name).toBe("reminderOptIn");
    expect(studentPreferences.reminderLeadHours.name).toBe("reminderLeadHours");
    expect(assignmentStatuses.dueSoonNotifiedAt.name).toBe("dueSoonNotifiedAt");
    expect(assignmentStatuses.overdueNotifiedAt.name).toBe("overdueNotifiedAt");
  });

  it("logs a completed focus session with an optional staff-assignment link", () => {
    expect(pomodoroSessions.studentId.name).toBe("studentId");
    expect(pomodoroSessions.assignmentId.name).toBe("assignmentId");
    expect(pomodoroSessions.durationMinutes.name).toBe("durationMinutes");
    expect(pomodoroSessions.completedAt.name).toBe("completedAt");
  });
});
