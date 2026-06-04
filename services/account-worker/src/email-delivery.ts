import {
  getEmailDeliveryJobById,
  markEmailDeliveryJobAttempt,
  markEmailDeliveryJobFailed,
  markEmailDeliveryJobSent,
} from "@neuro/account-domain";

import { env } from "@/env";

let smtpTransport: any = null;
const loadNodemailer = new Function("return import('nodemailer')") as () => Promise<{
  default?: {
    createTransport?: (...args: any[]) => any;
  };
  createTransport?: (...args: any[]) => any;
}>;

function buildFromHeader() {
  return env.emailFromName
    ? `"${env.emailFromName.replace(/"/g, '\\"')}" <${env.emailFromAddress}>`
    : env.emailFromAddress;
}

async function getSmtpTransport() {
  if (smtpTransport) {
    return smtpTransport;
  }

  if (!env.emailSmtpHost || !env.emailSmtpUser || !env.emailSmtpPass) {
    throw new Error("SMTP email delivery is enabled but SMTP credentials are incomplete");
  }

  const nodemailer = await loadNodemailer();
  const createTransport = nodemailer.createTransport || nodemailer.default?.createTransport;
  if (typeof createTransport !== "function") {
    throw new Error("Nodemailer createTransport entry is unavailable");
  }

  smtpTransport = createTransport({
    host: env.emailSmtpHost,
    port: env.emailSmtpPort,
    secure: env.emailSmtpSecure,
    auth: {
      user: env.emailSmtpUser,
      pass: env.emailSmtpPass,
    },
  });
  return smtpTransport;
}

async function sendThroughConfiguredTransport(job: Awaited<ReturnType<typeof getEmailDeliveryJobById>>) {
  if (!job) {
    throw new Error("Email delivery job not found");
  }

  if (env.emailDeliveryMode === "console") {
    console.log(
      `[account-worker][email] purpose=${job.purpose} to=${job.recipientEmail} subject=${job.subject}\n${job.textBody}`,
    );
    return;
  }

  const transport = await getSmtpTransport();
  await transport.sendMail({
    from: buildFromHeader(),
    to: job.recipientEmail,
    replyTo: env.emailReplyTo || undefined,
    subject: job.subject,
    text: job.textBody,
    html: job.htmlBody || undefined,
  });
}

export async function deliverEmailJob(jobId: string) {
  const existingJob = await getEmailDeliveryJobById(jobId);
  if (!existingJob) {
    return { delivered: false as const, skippedReason: "missing_job" };
  }

  if (existingJob.status === "sent") {
    return { delivered: false as const, skippedReason: "already_sent" };
  }

  await markEmailDeliveryJobAttempt(jobId);
  const job = await getEmailDeliveryJobById(jobId);
  if (!job) {
    return { delivered: false as const, skippedReason: "missing_job_after_attempt" };
  }

  try {
    await sendThroughConfiguredTransport(job);
    await markEmailDeliveryJobSent(jobId);
    return { delivered: true as const, skippedReason: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markEmailDeliveryJobFailed(jobId, message);
    throw error;
  }
}
