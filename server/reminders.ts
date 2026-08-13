import nodemailer from "nodemailer";
import type { Request, Response } from "express";
import { getReminderScheduleByTaskUid, listReminderCandidates, markReminderSent, type ReminderCandidate } from "./db";
import { sdk } from "./_core/sdk";

function smtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;
  if (!host || !user || !pass || !from || !Number.isInteger(port) || port < 1) throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM.");
  return { host, port, user, pass, from };
}

function emailFor(candidate: ReminderCandidate) {
  const due = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(candidate.dueDate);
  const subject = candidate.kind === "overdue" ? `Overdue: ${candidate.title}` : `Reminder: ${candidate.title} is due soon`;
  const title = candidate.kind === "overdue" ? "This assignment is overdue" : "This assignment is coming up";
  return {
    subject,
    text: `Hi ${candidate.studentName},\n\n${title}: ${candidate.title} (${candidate.subject}). Due: ${due}.\n\nOpen Neon Classroom Tracker to update your progress or adjust reminder settings.`,
    html: `<div style="font-family:Arial,sans-serif;background:#0a0c12;color:#eef8ff;padding:24px"><p style="color:#66e0ff;font-family:monospace;letter-spacing:1px">NEON CLASSROOM // DEADLINE SIGNAL</p><h2>${title}</h2><p>Hi ${candidate.studentName},</p><p><strong>${candidate.title}</strong> · ${candidate.subject}</p><p>Due: <strong>${due}</strong></p><p style="color:#8b94a9">Open Neon Classroom Tracker to update your progress or adjust reminder settings.</p></div>`,
  };
}

export async function runReminderDelivery() {
  const config = smtpConfig();
  const candidates = await listReminderCandidates();
  if (!candidates.length) return { sent: 0, skipped: 0 };
  const transporter = nodemailer.createTransport({ host: config.host, port: config.port, secure: config.port === 465, auth: { user: config.user, pass: config.pass } });
  let sent = 0;
  for (const candidate of candidates) {
    const message = emailFor(candidate);
    await transporter.sendMail({ from: config.from, to: candidate.studentEmail, ...message });
    await markReminderSent(candidate);
    sent += 1;
  }
  return { sent, skipped: 0 };
}

export async function scheduledReminderHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const schedule = await getReminderScheduleByTaskUid(user.taskUid);
    if (!schedule) return res.json({ ok: true, skipped: "orphan" });
    if (!schedule.enabled) return res.json({ ok: true, skipped: "paused" });
    const result = await runReminderDelivery();
    return res.json({ ok: true, ...result, taskUid: user.taskUid });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Reminder delivery failed", timestamp: new Date().toISOString() });
  }
}
