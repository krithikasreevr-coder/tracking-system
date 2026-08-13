import nodemailer from "nodemailer";
import { describe, expect, it } from "vitest";

describe("SMTP reminder configuration", () => {
  it.runIf(process.env.RUN_SMTP_LIVE_TEST === "true")("authenticates with the configured SMTP server", async () => {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT ?? "587");
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM;

    expect(host).toBeTruthy();
    expect(user).toBeTruthy();
    expect(pass).toBeTruthy();
    expect(from).toBeTruthy();
    expect(Number.isInteger(port)).toBe(true);

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      connectionTimeout: 10_000,
    });
    await expect(transporter.verify()).resolves.toBe(true);
  }, 15_000);
});
