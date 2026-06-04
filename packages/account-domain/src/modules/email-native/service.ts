import {
  type ConfirmEmailIdentityVerificationInput,
  type ConfirmEmailIdentityVerificationResult,
  type EmailDeliveryMode,
  type EmailIdentityVerificationView,
  type EmailIdentityView,
  type EmailNativeInboundMessageView,
  type EmailNativePanelView,
  type EmailNativeRouteCatalogView,
  type StartEmailIdentityVerificationInput,
  type StartEmailIdentityVerificationResult,
} from "@neuro/contracts";
import { and, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { createHash, createHmac, randomInt } from "node:crypto";

import { db } from "@/db/client";
import { env } from "@/env";
import { authIdentities } from "@/modules/identity/schema";
import { createMailboxMessage } from "@/modules/mailbox/service";
import { ConflictError, NotFoundError, BadRequestError } from "@/platform/errors";
import { createCoreAgentExecutionAsUser, createCoreTaskAsUser } from "@/platform/core-integration/write";
import { enqueueOutboxEvent } from "@/platform/outbox/service";

import {
  buildEmailNativeAgentExecutionInput,
  buildEmailNativeTaskInput,
  extractEmailNativeRoute,
  getEmailNativeRouteKindLabel,
  normalizeEmailAddress,
} from "./model";
import {
  emailDeliveryJobs,
  emailIdentityVerifications,
  emailNativeInboundMessages,
} from "./schema";

type DbTx = typeof db | any;

type EmailDeliveryPurpose = "identity_verification" | "email_native_receipt" | "email_native_result";
type EmailDeliveryStatus = "pending" | "sent" | "failed";
type EmailIdentityVerificationStatus = "pending" | "verified" | "expired" | "canceled";

type EmailDeliveryJobRecord = typeof emailDeliveryJobs.$inferSelect;

function now() {
  return new Date();
}

function requireVerificationSecret() {
  if (!env.emailVerificationSecret) {
    throw new BadRequestError("Email verification secret is not configured");
  }
  return env.emailVerificationSecret;
}

function buildVerificationCodeHash(email: string, code: string) {
  return createHmac("sha256", requireVerificationSecret())
    .update(`${normalizeEmailAddress(email)}:${code}`)
    .digest("hex");
}

function generateVerificationCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function buildInboundIdempotencyKey(input: {
  fromEmail: string;
  toEmail: string;
  subject: string | null;
  textBody: string;
  providerMessageId: string | null;
}) {
  if (input.providerMessageId) {
    return `provider:${normalizeEmailAddress(input.providerMessageId)}`;
  }

  return createHash("sha256")
    .update(
      JSON.stringify({
        fromEmail: normalizeEmailAddress(input.fromEmail),
        toEmail: normalizeEmailAddress(input.toEmail),
        subject: input.subject?.trim() || "",
        textBody: input.textBody.trim(),
      }),
    )
    .digest("hex");
}

function mapEmailIdentityView(row: typeof authIdentities.$inferSelect): EmailIdentityView {
  const email = row.email?.trim() || row.providerUserId;
  return {
    id: row.id,
    email,
    normalizedEmail: row.providerUserId,
    isPrimary: row.isPrimary,
    invocationEnabled: row.emailInvocationEnabled,
    deliveryEnabled: row.emailDeliveryEnabled,
    verifiedAt: row.verifiedAt?.toISOString() || row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapEmailIdentityVerificationView(
  row: typeof emailIdentityVerifications.$inferSelect,
): EmailIdentityVerificationView {
  return {
    id: row.id,
    email: row.email,
    normalizedEmail: row.normalizedEmail,
    status: row.status as EmailIdentityVerificationStatus,
    markAsPrimary: row.markAsPrimary,
    requestedAt: row.requestedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    consumedAt: row.consumedAt ? row.consumedAt.toISOString() : null,
  };
}

function mapEmailNativeInboundMessageView(
  row: typeof emailNativeInboundMessages.$inferSelect,
): EmailNativeInboundMessageView {
  return {
    id: row.id,
    fromEmail: row.fromEmail,
    toEmail: row.toEmail,
    subject: row.subject,
    routeKind:
      row.routeKind === "agent_execution" || row.routeKind === "task_create"
        ? row.routeKind
        : null,
    status: row.status as EmailNativeInboundMessageView["status"],
    rejectionReason: row.rejectionReason,
    createdTaskId: row.createdTaskId,
    createdExecutionId: row.createdExecutionId,
    receivedAt: row.receivedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function buildRouteCatalog(): EmailNativeRouteCatalogView {
  return {
    ingressDomain: env.emailIngressDomain,
    deliveryMode: env.emailDeliveryMode,
    taskDefaults: {
      rewardCurrency: env.emailTaskDefaultRewardCurrency,
      rewardAmount: env.emailTaskDefaultRewardAmount,
      requiredBondAmount: env.emailTaskDefaultBondAmount,
      pricingMode: env.emailTaskDefaultPricingMode,
      operationMode: env.emailTaskDefaultOperationMode,
    },
    instructions: [
      {
        routeKind: "agent_execution",
        title: "Agent 调用入口",
        addressPattern: `agent+<agentId>@${env.emailIngressDomain}`,
        description: "主题用作默认标题，正文将作为 objective；可在正文开头使用 key:value 头部覆盖 capabilityId 或 runtimeProfileKey。",
        metadataKeys: ["title", "capabilityId", "runtimeProfileKey"],
      },
      {
        routeKind: "task_create",
        title: "任务创建入口",
        addressPattern: `task@${env.emailIngressDomain}`,
        description: "主题用作默认任务标题，正文主体用作 description；reward 和 pricing 可省略，平台会按默认值补齐。",
        metadataKeys: [
          "title",
          "rewardCurrency",
          "rewardAmount",
          "requiredBondAmount",
          "pricingMode",
          "billingUnit",
          "meterKey",
          "meterQuantity",
          "operationMode",
          "preferredCapabilityCodes",
        ],
      },
    ],
  };
}

async function expireEmailIdentityVerificationsInTx(tx: DbTx, userId?: string | null) {
  const currentTime = now();
  const conditions = [
    eq(emailIdentityVerifications.status, "pending"),
    sql`${emailIdentityVerifications.expiresAt} <= ${currentTime}`,
  ];

  if (userId) {
    conditions.push(eq(emailIdentityVerifications.userId, userId));
  }

  await tx
    .update(emailIdentityVerifications)
    .set({
      status: "expired",
      updatedAt: currentTime,
    })
    .where(and(...conditions));
}

async function createEmailDeliveryJobInTx(args: {
  tx: DbTx;
  userId?: string | null;
  emailIdentityId?: string | null;
  purpose: EmailDeliveryPurpose;
  recipientEmail: string;
  subject: string;
  textBody: string;
  htmlBody?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
}) {
  if (args.referenceType && args.referenceId) {
    const [existingJob] = await args.tx
      .select()
      .from(emailDeliveryJobs)
      .where(
        and(
          eq(emailDeliveryJobs.referenceType, args.referenceType),
          eq(emailDeliveryJobs.referenceId, args.referenceId),
        ),
      )
      .limit(1);
    if (existingJob) {
      return existingJob;
    }
  }

  const currentTime = now();
  const [job] = await args.tx
    .insert(emailDeliveryJobs)
    .values({
      id: crypto.randomUUID(),
      userId: args.userId ?? null,
      emailIdentityId: args.emailIdentityId ?? null,
      purpose: args.purpose,
      recipientEmail: normalizeEmailAddress(args.recipientEmail),
      subject: args.subject,
      textBody: args.textBody,
      htmlBody: args.htmlBody ?? null,
      referenceType: args.referenceType ?? null,
      referenceId: args.referenceId ?? null,
      status: "pending",
      attemptCount: 0,
      lastAttemptAt: null,
      sentAt: null,
      lastError: null,
      createdAt: currentTime,
      updatedAt: currentTime,
    })
    .returning();

  await enqueueOutboxEvent(
    "email.delivery.requested",
    {
      jobId: job.id,
      purpose: job.purpose,
    },
    args.tx,
  );

  return job;
}

function buildVerificationEmail(args: {
  email: string;
  code: string;
  expiresAt: Date;
}) {
  const expiresAtLabel = args.expiresAt.toLocaleString("zh-CN");
  return {
    subject: "NeuroPlatform 邮箱绑定验证码",
    textBody: [
      "你正在为 NeuroPlatform 绑定一个真实邮箱身份。",
      "",
      `邮箱地址：${args.email}`,
      `验证码：${args.code}`,
      `有效期至：${expiresAtLabel}`,
      "",
      "如果这不是你本人发起，请忽略本邮件。",
    ].join("\n"),
  };
}

function buildInboundReceiptEmail(args: {
  status: "accepted" | "rejected";
  routeKind: EmailNativeInboundMessageView["routeKind"];
  toEmail: string;
  createdTaskId?: string | null;
  createdExecutionId?: string | null;
  rejectionReason?: string | null;
}) {
  const routeLabel = getEmailNativeRouteKindLabel(args.routeKind ?? null);
  if (args.status === "accepted") {
    return {
      subject: `NeuroPlatform 已接受你的${routeLabel}`,
      textBody: [
        `你的 ${routeLabel} 邮件已被 NeuroPlatform 接受。`,
        `目标地址：${args.toEmail}`,
        args.createdExecutionId ? `执行单号：${args.createdExecutionId}` : null,
        args.createdTaskId ? `任务单号：${args.createdTaskId}` : null,
        "",
        "结果后续会继续投递到该邮箱，并同步投影到站内邮箱。",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  return {
    subject: `NeuroPlatform 未接受你的${routeLabel}`,
    textBody: [
      `你的 ${routeLabel} 邮件未被接受。`,
      `目标地址：${args.toEmail}`,
      args.rejectionReason ? `原因：${args.rejectionReason}` : null,
      "",
      "请检查发件邮箱是否已绑定，或核对收件地址与正文格式。",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

async function markEmailIdentityUsedInTx(tx: DbTx, emailIdentityId: string) {
  await tx
    .update(authIdentities)
    .set({
      lastUsedAt: now(),
      updatedAt: now(),
    })
    .where(eq(authIdentities.id, emailIdentityId));
}

export async function getEmailNativePanel(userId: string): Promise<EmailNativePanelView> {
  await db.transaction(async (tx) => {
    await expireEmailIdentityVerificationsInTx(tx, userId);
  });

  const [identityRows, verificationRows, inboundRows] = await Promise.all([
    db
      .select()
      .from(authIdentities)
      .where(and(eq(authIdentities.userId, userId), eq(authIdentities.provider, "email"), isNotNull(authIdentities.verifiedAt)))
      .orderBy(desc(authIdentities.isPrimary), desc(authIdentities.verifiedAt), desc(authIdentities.createdAt)),
    db
      .select()
      .from(emailIdentityVerifications)
      .where(and(eq(emailIdentityVerifications.userId, userId), eq(emailIdentityVerifications.status, "pending")))
      .orderBy(desc(emailIdentityVerifications.requestedAt))
      .limit(5),
    db
      .select()
      .from(emailNativeInboundMessages)
      .where(eq(emailNativeInboundMessages.userId, userId))
      .orderBy(desc(emailNativeInboundMessages.createdAt))
      .limit(20),
  ]);

  return {
    deliveryMode: env.emailDeliveryMode,
    identities: identityRows.map(mapEmailIdentityView),
    pendingVerifications: verificationRows.map(mapEmailIdentityVerificationView),
    recentInboundMessages: inboundRows.map(mapEmailNativeInboundMessageView),
    routeCatalog: buildRouteCatalog(),
  };
}

export async function startEmailIdentityVerification(
  userId: string,
  input: StartEmailIdentityVerificationInput,
): Promise<StartEmailIdentityVerificationResult> {
  const normalizedEmail = normalizeEmailAddress(input.email);
  const verificationCode = generateVerificationCode();

  return db.transaction(async (tx) => {
    await expireEmailIdentityVerificationsInTx(tx, userId);

    const [existingIdentity] = await tx
      .select()
      .from(authIdentities)
      .where(and(eq(authIdentities.provider, "email"), eq(authIdentities.providerUserId, normalizedEmail)))
      .limit(1);

    if (existingIdentity?.userId === userId) {
      throw new ConflictError("该邮箱已经绑定到当前账户");
    }
    if (existingIdentity && existingIdentity.userId !== userId) {
      throw new ConflictError("该邮箱已经绑定到其他账户");
    }

    await tx
      .update(emailIdentityVerifications)
      .set({
        status: "canceled",
        updatedAt: now(),
      })
      .where(
        and(
          eq(emailIdentityVerifications.userId, userId),
          eq(emailIdentityVerifications.normalizedEmail, normalizedEmail),
          eq(emailIdentityVerifications.status, "pending"),
        ),
      );

    const currentTime = now();
    const expiresAt = new Date(currentTime.getTime() + env.emailVerificationTtlMinutes * 60 * 1000);
    const [verification] = await tx
      .insert(emailIdentityVerifications)
      .values({
        id: crypto.randomUUID(),
        userId,
        email: input.email.trim(),
        normalizedEmail,
        verificationCodeHash: buildVerificationCodeHash(normalizedEmail, verificationCode),
        markAsPrimary: input.makePrimary === true,
        status: "pending",
        attemptCount: 0,
        requestedAt: currentTime,
        expiresAt,
        consumedAt: null,
        createdAt: currentTime,
        updatedAt: currentTime,
      })
      .returning();

    const emailContent = buildVerificationEmail({
      email: verification.email,
      code: verificationCode,
      expiresAt,
    });

    await createEmailDeliveryJobInTx({
      tx,
      userId,
      emailIdentityId: null,
      purpose: "identity_verification",
      recipientEmail: verification.email,
      subject: emailContent.subject,
      textBody: emailContent.textBody,
      referenceType: "email_identity_verification",
      referenceId: verification.id,
    });

    return {
      verification: mapEmailIdentityVerificationView(verification),
      debugCode:
        env.emailDeliveryMode === "console" && env.emailConsoleExposeVerificationCode
          ? verificationCode
          : null,
    };
  });
}

export async function confirmEmailIdentityVerification(
  userId: string,
  input: ConfirmEmailIdentityVerificationInput,
): Promise<ConfirmEmailIdentityVerificationResult> {
  const normalizedEmail = normalizeEmailAddress(input.email);
  const normalizedCode = input.code.trim();

  return db.transaction(async (tx) => {
    await expireEmailIdentityVerificationsInTx(tx, userId);

    const [verification] = await tx
      .select()
      .from(emailIdentityVerifications)
      .where(
        and(
          eq(emailIdentityVerifications.userId, userId),
          eq(emailIdentityVerifications.normalizedEmail, normalizedEmail),
          eq(emailIdentityVerifications.status, "pending"),
        ),
      )
      .orderBy(desc(emailIdentityVerifications.requestedAt))
      .limit(1);

    if (!verification) {
      throw new NotFoundError("未找到可用的邮箱验证码，请重新发起绑定");
    }

    if (verification.expiresAt.getTime() <= now().getTime()) {
      await tx
        .update(emailIdentityVerifications)
        .set({
          status: "expired",
          updatedAt: now(),
        })
        .where(eq(emailIdentityVerifications.id, verification.id));
      throw new ConflictError("验证码已过期，请重新发起绑定");
    }

    if (verification.verificationCodeHash !== buildVerificationCodeHash(normalizedEmail, normalizedCode)) {
      await tx
        .update(emailIdentityVerifications)
        .set({
          attemptCount: verification.attemptCount + 1,
          updatedAt: now(),
        })
        .where(eq(emailIdentityVerifications.id, verification.id));
      throw new ConflictError("验证码不正确");
    }

    const [conflictingIdentity] = await tx
      .select()
      .from(authIdentities)
      .where(and(eq(authIdentities.provider, "email"), eq(authIdentities.providerUserId, normalizedEmail)))
      .limit(1);

    if (conflictingIdentity && conflictingIdentity.userId !== userId) {
      throw new ConflictError("该邮箱已经绑定到其他账户");
    }

    const existingIdentityRows = await tx
      .select()
      .from(authIdentities)
      .where(and(eq(authIdentities.userId, userId), eq(authIdentities.provider, "email")))
      .orderBy(desc(authIdentities.isPrimary), desc(authIdentities.createdAt));
    const hasPrimary = existingIdentityRows.some((row) => row.isPrimary);
    const shouldBePrimary = verification.markAsPrimary || !hasPrimary;
    const currentTime = now();

    if (shouldBePrimary) {
      await tx
        .update(authIdentities)
        .set({
          isPrimary: false,
          updatedAt: currentTime,
        })
        .where(and(eq(authIdentities.userId, userId), eq(authIdentities.provider, "email")));
    }

    let identityRow: typeof authIdentities.$inferSelect;
    if (conflictingIdentity) {
      const [updatedIdentity] = await tx
        .update(authIdentities)
        .set({
          email: verification.email,
          verifiedAt: currentTime,
          isPrimary: shouldBePrimary ? true : conflictingIdentity.isPrimary,
          emailInvocationEnabled: true,
          emailDeliveryEnabled: true,
          updatedAt: currentTime,
        })
        .where(eq(authIdentities.id, conflictingIdentity.id))
        .returning();
      identityRow = updatedIdentity;
    } else {
      const [createdIdentity] = await tx
        .insert(authIdentities)
        .values({
          id: crypto.randomUUID(),
          userId,
          provider: "email",
          providerUserId: normalizedEmail,
          email: verification.email,
          verifiedAt: currentTime,
          isPrimary: shouldBePrimary,
          emailInvocationEnabled: true,
          emailDeliveryEnabled: true,
          lastUsedAt: null,
          createdAt: currentTime,
          updatedAt: currentTime,
        })
        .returning();
      identityRow = createdIdentity;
    }

    await tx
      .update(emailIdentityVerifications)
      .set({
        status: "verified",
        consumedAt: currentTime,
        updatedAt: currentTime,
      })
      .where(eq(emailIdentityVerifications.id, verification.id));

    await createMailboxMessage({
      userId,
      title: "真实邮箱已绑定",
      body: `邮箱 ${verification.email} 已通过验证，现在可以作为 Email-Native 调用入口与结果投递地址。`,
      type: "system",
      sourceLabel: "Identity",
    });

    return {
      identity: mapEmailIdentityView(identityRow),
    };
  });
}

export async function setPrimaryEmailIdentity(userId: string, identityId: string): Promise<EmailIdentityView> {
  return db.transaction(async (tx) => {
    const [identity] = await tx
      .select()
      .from(authIdentities)
      .where(
        and(
          eq(authIdentities.id, identityId),
          eq(authIdentities.userId, userId),
          eq(authIdentities.provider, "email"),
        ),
      )
      .limit(1);

    if (!identity) {
      throw new NotFoundError("未找到指定邮箱身份");
    }

    const currentTime = now();
    await tx
      .update(authIdentities)
      .set({
        isPrimary: false,
        updatedAt: currentTime,
      })
      .where(and(eq(authIdentities.userId, userId), eq(authIdentities.provider, "email")));

    const [updatedIdentity] = await tx
      .update(authIdentities)
      .set({
        isPrimary: true,
        updatedAt: currentTime,
      })
      .where(eq(authIdentities.id, identity.id))
      .returning();

    return mapEmailIdentityView(updatedIdentity);
  });
}

export async function removeEmailIdentity(userId: string, identityId: string) {
  return db.transaction(async (tx) => {
    const [identity] = await tx
      .select()
      .from(authIdentities)
      .where(
        and(
          eq(authIdentities.id, identityId),
          eq(authIdentities.userId, userId),
          eq(authIdentities.provider, "email"),
        ),
      )
      .limit(1);

    if (!identity) {
      throw new NotFoundError("未找到指定邮箱身份");
    }

    await tx.delete(authIdentities).where(eq(authIdentities.id, identity.id));

    if (identity.isPrimary) {
      const [fallbackIdentity] = await tx
        .select()
        .from(authIdentities)
        .where(and(eq(authIdentities.userId, userId), eq(authIdentities.provider, "email")))
        .orderBy(desc(authIdentities.verifiedAt), desc(authIdentities.createdAt))
        .limit(1);

      if (fallbackIdentity) {
        await tx
          .update(authIdentities)
          .set({
            isPrimary: true,
            updatedAt: now(),
          })
          .where(eq(authIdentities.id, fallbackIdentity.id));
      }
    }

    return { removed: true as const };
  });
}

async function createInboundMailboxProjection(args: {
  userId: string;
  status: "accepted" | "rejected";
  routeKind: EmailNativeInboundMessageView["routeKind"];
  fromEmail: string;
  createdTaskId?: string | null;
  createdExecutionId?: string | null;
  rejectionReason?: string | null;
}) {
  const routeLabel = getEmailNativeRouteKindLabel(args.routeKind ?? null);
  await createMailboxMessage({
    userId: args.userId,
    title: args.status === "accepted" ? "邮件调用已受理" : "邮件调用未受理",
    body:
      args.status === "accepted"
        ? `来自 ${args.fromEmail} 的 ${routeLabel} 邮件已受理。${args.createdExecutionId ? ` 执行单号：${args.createdExecutionId}。` : ""}${args.createdTaskId ? ` 任务单号：${args.createdTaskId}。` : ""}`
        : `来自 ${args.fromEmail} 的 ${routeLabel} 邮件未受理。${args.rejectionReason ? ` 原因：${args.rejectionReason}` : ""}`,
    type: "system",
    sourceLabel: "Email-Native",
  });
}

async function queueInboundReceiptDeliveryInTx(args: {
  tx: DbTx;
  inboundId: string;
  userId: string;
  emailIdentityId: string;
  recipientEmail: string;
  toEmail: string;
  status: "accepted" | "rejected";
  routeKind: EmailNativeInboundMessageView["routeKind"];
  createdTaskId?: string | null;
  createdExecutionId?: string | null;
  rejectionReason?: string | null;
}) {
  const emailContent = buildInboundReceiptEmail({
    status: args.status,
    routeKind: args.routeKind,
    toEmail: args.toEmail,
    createdTaskId: args.createdTaskId,
    createdExecutionId: args.createdExecutionId,
    rejectionReason: args.rejectionReason,
  });

  await createEmailDeliveryJobInTx({
    tx: args.tx,
    userId: args.userId,
    emailIdentityId: args.emailIdentityId,
    purpose: "email_native_receipt",
    recipientEmail: args.recipientEmail,
    subject: emailContent.subject,
    textBody: emailContent.textBody,
    referenceType: "email_native_receipt",
    referenceId: args.inboundId,
  });
}

export async function ingestEmailNativeInboundMessage(input: {
  fromEmail: string;
  toEmail: string;
  subject?: string | null;
  textBody?: string | null;
  htmlBody?: string | null;
  providerMessageId?: string | null;
  receivedAt?: string | null;
}): Promise<EmailNativeInboundMessageView> {
  const normalizedFromEmail = normalizeEmailAddress(input.fromEmail);
  const normalizedToEmail = normalizeEmailAddress(input.toEmail);
  const subject = input.subject?.trim() || null;
  const textBody = input.textBody?.trim() || "";
  const htmlBody = input.htmlBody?.trim() || null;
  const providerMessageId = input.providerMessageId?.trim() || null;
  const receivedAt =
    input.receivedAt && !Number.isNaN(Date.parse(input.receivedAt))
      ? new Date(input.receivedAt)
      : now();

  if (!textBody) {
    throw new BadRequestError("Inbound email text body is required");
  }

  const idempotencyKey = buildInboundIdempotencyKey({
    fromEmail: normalizedFromEmail,
    toEmail: normalizedToEmail,
    subject,
    textBody,
    providerMessageId,
  });

  const [existingInbound] = await db
    .select()
    .from(emailNativeInboundMessages)
    .where(eq(emailNativeInboundMessages.idempotencyKey, idempotencyKey))
    .limit(1);
  if (existingInbound) {
    return mapEmailNativeInboundMessageView(existingInbound);
  }

  return db.transaction(async (tx) => {
    const [emailIdentity] = await tx
      .select()
      .from(authIdentities)
      .where(
        and(
          eq(authIdentities.provider, "email"),
          eq(authIdentities.providerUserId, normalizedFromEmail),
          eq(authIdentities.emailInvocationEnabled, true),
          isNotNull(authIdentities.verifiedAt),
        ),
      )
      .limit(1);

    const route = extractEmailNativeRoute(normalizedToEmail, env.emailIngressDomain);
    const currentTime = now();
    let status: EmailNativeInboundMessageView["status"] = "accepted";
    let rejectionReason: string | null = null;
    let createdTaskId: string | null = null;
    let createdExecutionId: string | null = null;

    if (!emailIdentity) {
      status = "rejected";
      rejectionReason = "发件邮箱未绑定或未启用 Email-Native 调用";
    } else if (!route) {
      status = "rejected";
      rejectionReason = `收件地址不受支持，仅支持 @${env.emailIngressDomain} 的 agent+/task 入口`;
    } else {
      try {
        if (route.kind === "agent_execution") {
          const execution = await createCoreAgentExecutionAsUser(
            emailIdentity.userId,
            buildEmailNativeAgentExecutionInput({
              route,
              subject,
              textBody,
            }),
          );
          createdExecutionId = execution.id;
        } else {
          const task = await createCoreTaskAsUser(
            emailIdentity.userId,
            buildEmailNativeTaskInput({
              subject,
              textBody,
              defaults: {
                rewardCurrency: env.emailTaskDefaultRewardCurrency,
                rewardAmount: env.emailTaskDefaultRewardAmount,
                requiredBondAmount: env.emailTaskDefaultBondAmount,
                pricingMode: env.emailTaskDefaultPricingMode,
                operationMode: env.emailTaskDefaultOperationMode,
              },
            }),
          );
          createdTaskId = task.id;
        }
      } catch (error) {
        status = "rejected";
        rejectionReason = error instanceof Error ? error.message : "Email-Native route execution failed";
      }
    }

    const [inboundRow] = await tx
      .insert(emailNativeInboundMessages)
      .values({
        id: crypto.randomUUID(),
        userId: emailIdentity?.userId ?? null,
        emailIdentityId: emailIdentity?.id ?? null,
        fromEmail: normalizedFromEmail,
        normalizedFromEmail,
        toEmail: normalizedToEmail,
        normalizedToEmail,
        providerMessageId,
        idempotencyKey,
        subject,
        textBody,
        htmlBody,
        routeKind: route?.kind ?? null,
        status,
        rejectionReason,
        createdTaskId,
        createdExecutionId,
        receivedAt,
        createdAt: currentTime,
        updatedAt: currentTime,
      })
      .returning();

    if (emailIdentity) {
      await markEmailIdentityUsedInTx(tx, emailIdentity.id);
      await queueInboundReceiptDeliveryInTx({
        tx,
        inboundId: inboundRow.id,
        userId: emailIdentity.userId,
        emailIdentityId: emailIdentity.id,
        recipientEmail: normalizedFromEmail,
        toEmail: normalizedToEmail,
        status,
        routeKind: route?.kind ?? null,
        createdTaskId,
        createdExecutionId,
        rejectionReason,
      });
    }

    return mapEmailNativeInboundMessageView(inboundRow);
  }).then(async (view) => {
    if (view.status !== "duplicate") {
      const [row] = await db
        .select()
        .from(emailNativeInboundMessages)
        .where(eq(emailNativeInboundMessages.id, view.id))
        .limit(1);
      if (row?.userId) {
        await createInboundMailboxProjection({
          userId: row.userId,
          status: view.status === "accepted" ? "accepted" : "rejected",
          routeKind: view.routeKind,
          fromEmail: view.fromEmail,
          createdTaskId: view.createdTaskId,
          createdExecutionId: view.createdExecutionId,
          rejectionReason: view.rejectionReason,
        });
      }
    }
    return view;
  });
}

export async function getEmailDeliveryJobById(jobId: string) {
  const [job] = await db.select().from(emailDeliveryJobs).where(eq(emailDeliveryJobs.id, jobId)).limit(1);
  return job ?? null;
}

export async function markEmailDeliveryJobAttempt(jobId: string) {
  const currentTime = now();
  const [job] = await db
    .update(emailDeliveryJobs)
    .set({
      attemptCount: sql`${emailDeliveryJobs.attemptCount} + 1`,
      lastAttemptAt: currentTime,
      updatedAt: currentTime,
    })
    .where(eq(emailDeliveryJobs.id, jobId))
    .returning();
  return job ?? null;
}

export async function markEmailDeliveryJobSent(jobId: string) {
  const currentTime = now();
  const [job] = await db
    .update(emailDeliveryJobs)
    .set({
      status: "sent",
      sentAt: currentTime,
      lastError: null,
      updatedAt: currentTime,
    })
    .where(eq(emailDeliveryJobs.id, jobId))
    .returning();

  if (job?.emailIdentityId) {
    await db
      .update(authIdentities)
      .set({
        lastUsedAt: currentTime,
        updatedAt: currentTime,
      })
      .where(eq(authIdentities.id, job.emailIdentityId));
  }

  return job ?? null;
}

export async function markEmailDeliveryJobFailed(jobId: string, errorMessage: string) {
  const currentTime = now();
  const [job] = await db
    .update(emailDeliveryJobs)
    .set({
      status: "failed",
      lastError: errorMessage,
      updatedAt: currentTime,
    })
    .where(eq(emailDeliveryJobs.id, jobId))
    .returning();
  return job ?? null;
}

async function queueLifecycleDeliveryForInboundRows(args: {
  inboundRows: Array<typeof emailNativeInboundMessages.$inferSelect>;
  purposeSuffix: string;
  subject: string;
  textBody: string;
}) {
  await db.transaction(async (tx) => {
    for (const inboundRow of args.inboundRows) {
      if (!inboundRow.userId || !inboundRow.emailIdentityId) {
        continue;
      }
      await createEmailDeliveryJobInTx({
        tx,
        userId: inboundRow.userId,
        emailIdentityId: inboundRow.emailIdentityId,
        purpose: "email_native_result",
        recipientEmail: inboundRow.fromEmail,
        subject: args.subject,
        textBody: args.textBody,
        referenceType: args.purposeSuffix,
        referenceId: inboundRow.id,
      });
    }
  });
}

export async function queueEmailNativeExecutionLifecycleDelivery(args: {
  executionId: string;
  subject: string;
  textBody: string;
  referenceType: string;
}) {
  const inboundRows = await db
    .select()
    .from(emailNativeInboundMessages)
    .where(
      and(
        eq(emailNativeInboundMessages.createdExecutionId, args.executionId),
        eq(emailNativeInboundMessages.status, "accepted"),
      ),
    );

  if (inboundRows.length === 0) {
    return { queuedCount: 0 };
  }

  await queueLifecycleDeliveryForInboundRows({
    inboundRows,
    purposeSuffix: args.referenceType,
    subject: args.subject,
    textBody: args.textBody,
  });

  return { queuedCount: inboundRows.length };
}

export async function queueEmailNativeTaskLifecycleDelivery(args: {
  taskId: string;
  subject: string;
  textBody: string;
  referenceType: string;
}) {
  const inboundRows = await db
    .select()
    .from(emailNativeInboundMessages)
    .where(
      and(
        eq(emailNativeInboundMessages.createdTaskId, args.taskId),
        eq(emailNativeInboundMessages.status, "accepted"),
      ),
    );

  if (inboundRows.length === 0) {
    return { queuedCount: 0 };
  }

  await queueLifecycleDeliveryForInboundRows({
    inboundRows,
    purposeSuffix: args.referenceType,
    subject: args.subject,
    textBody: args.textBody,
  });

  return { queuedCount: inboundRows.length };
}
