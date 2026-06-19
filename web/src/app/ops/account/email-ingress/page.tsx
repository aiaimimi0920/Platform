import type { EmailProviderInboundMessageView } from "@/lib/account-client";
import { listOperatorEmailProviderInboundMessages } from "@/lib/account-client";
import { auth } from "@/auth";
import { NtBadge, NtCard, NtPanel, type NtBadgeTone } from "@/components/nt-primitives";
import { isPlatformOperatorUserId, requirePlatformOperatorUserContext } from "@/lib/platform-session";
import Link from "next/link";
import { redirect } from "next/navigation";

import { retryEmailProviderInboundMessageAction } from "./actions";

type EmailIngressOpsPageProps = {
  searchParams?: Promise<{
    status?: string;
    message?: string;
    limit?: string;
  }>;
};

function parseLimit(value: string | undefined) {
  const raw = Number(value || 40);
  if (!Number.isFinite(raw)) {
    return 40;
  }
  return Math.max(10, Math.min(Math.floor(raw), 100));
}

function formatShanghaiDateTime(value: string | null) {
  if (!value) {
    return "未处理";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getProcessingBadgeTone(
  state: EmailProviderInboundMessageView["processingState"],
): NtBadgeTone {
  if (state === "processed") {
    return "success";
  }
  if (state === "failed") {
    return "danger";
  }
  return "warning";
}

function getProcessingLabel(state: EmailProviderInboundMessageView["processingState"]) {
  if (state === "processed") {
    return "已处理";
  }
  if (state === "failed") {
    return "处理失败";
  }
  return "待消费";
}

function getCanonicalBadgeTone(
  state: EmailProviderInboundMessageView["canonicalInboundStatus"],
): NtBadgeTone {
  if (state === "accepted") {
    return "success";
  }
  if (state === "rejected") {
    return "danger";
  }
  if (state === "duplicate") {
    return "secondary";
  }
  return "glass";
}

function getCanonicalLabel(state: EmailProviderInboundMessageView["canonicalInboundStatus"]) {
  if (state === "accepted") {
    return "已受理";
  }
  if (state === "rejected") {
    return "已拒绝";
  }
  if (state === "duplicate") {
    return "重复";
  }
  return "未进入主链";
}

function StatCard(props: { label: string; value: number; tone?: NtBadgeTone }) {
  return (
    <NtCard style={{ display: "grid", gap: 10 }}>
      <NtBadge tone={props.tone ?? "glass"}>{props.label}</NtBadge>
      <strong style={{ fontSize: "1.8rem", color: "rgba(243,245,247,0.96)" }}>{props.value}</strong>
    </NtCard>
  );
}

function DetailCell(props: { label: string; value: string | null }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <span className="nt-kicker" style={{ fontSize: "0.72rem" }}>
        {props.label}
      </span>
      <span style={{ color: "rgba(243,245,247,0.88)", wordBreak: "break-word" }}>{props.value || "—"}</span>
    </div>
  );
}

function MessageCard(props: { message: EmailProviderInboundMessageView }) {
  const redirectTo = "/ops/account/email-ingress";
  const isRetriable = props.message.processingState === "failed";

  return (
    <NtCard style={{ display: "grid", gap: 18 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <NtBadge tone="cyan">{props.message.provider}</NtBadge>
            <NtBadge tone={getProcessingBadgeTone(props.message.processingState)}>
              {getProcessingLabel(props.message.processingState)}
            </NtBadge>
            <NtBadge tone={getCanonicalBadgeTone(props.message.canonicalInboundStatus)}>
              {getCanonicalLabel(props.message.canonicalInboundStatus)}
            </NtBadge>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <strong style={{ fontSize: "1.05rem", color: "rgba(243,245,247,0.96)" }}>
              {props.message.subject || "(无主题)"}
            </strong>
            <span style={{ color: "rgba(190,199,217,0.76)", fontSize: "0.92rem" }}>
              {props.message.fromEmail}
              {" -> "}
              {props.message.toEmail}
            </span>
          </div>
        </div>

        {isRetriable ? (
          <form action={retryEmailProviderInboundMessageAction}>
            <input name="redirectTo" type="hidden" value={redirectTo} />
            <input name="providerInboundMessageId" type="hidden" value={props.message.id} />
            <button className="nt-btn nt-btn--primary" type="submit">
              重新入队
            </button>
          </form>
        ) : null}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        <DetailCell label="Provider Message ID" value={props.message.providerMessageId} />
        <DetailCell label="Provider Event ID" value={props.message.providerEventId} />
        <DetailCell label="Canonical Inbound ID" value={props.message.canonicalInboundMessageId} />
        <DetailCell label="附件数" value={String(props.message.attachmentCount)} />
        <DetailCell label="接收时间" value={formatShanghaiDateTime(props.message.receivedAt)} />
        <DetailCell label="处理时间" value={formatShanghaiDateTime(props.message.processedAt)} />
      </div>

      {props.message.canonicalRejectionReason ? (
        <NtPanel
          style={{
            display: "grid",
            gap: 8,
            borderColor: "rgba(244,63,94,0.22)",
            background: "rgba(39,11,17,0.72)",
          }}
        >
          <span className="nt-kicker">拒绝原因</span>
          <span style={{ color: "#fecdd3" }}>{props.message.canonicalRejectionReason}</span>
        </NtPanel>
      ) : null}

      {props.message.lastError ? (
        <NtPanel
          style={{
            display: "grid",
            gap: 8,
            borderColor: "rgba(245,158,11,0.22)",
            background: "rgba(44,28,7,0.72)",
          }}
        >
          <span className="nt-kicker">最近错误</span>
          <span style={{ color: "#fde68a", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {props.message.lastError}
          </span>
        </NtPanel>
      ) : null}
    </NtCard>
  );
}

export default async function EmailIngressOpsPage({ searchParams }: EmailIngressOpsPageProps) {
  const session = await auth();
  if (!session?.user?.id || !isPlatformOperatorUserId(session.user.id, session.user.providerUserId)) {
    redirect(`/dashboard?status=error&message=${encodeURIComponent("只有平台管理员可以访问真实邮件网关面板。")}`);
  }

  const params = searchParams ? await searchParams : undefined;
  const limit = parseLimit(params?.limit);
  const userContext = await requirePlatformOperatorUserContext();
  const messages = await listOperatorEmailProviderInboundMessages(userContext, { limit });

  const receivedCount = messages.filter((message) => message.processingState === "received").length;
  const processedCount = messages.filter((message) => message.processingState === "processed").length;
  const failedCount = messages.filter((message) => message.processingState === "failed").length;
  const acceptedCount = messages.filter((message) => message.canonicalInboundStatus === "accepted").length;
  const rejectedCount = messages.filter((message) => message.canonicalInboundStatus === "rejected").length;

  return (
    <div className="nt-shell" style={{ display: "grid", gap: 24, padding: "24px 0 40px" }}>
      <section style={{ display: "grid", gap: 12 }}>
        <span className="nt-kicker">邮件入口 / Mailgun</span>
        <div style={{ display: "grid", gap: 10 }}>
          <h1 style={{ margin: 0, color: "rgba(243,245,247,0.98)", fontSize: "2rem", lineHeight: 1.1 }}>
            真实邮件网关
          </h1>
          <p style={{ margin: 0, color: "rgba(190,199,217,0.82)", maxWidth: "84ch", lineHeight: 1.7 }}>
            这里集中回看真实邮件服务商的入站审计、邮件入口主链归一结果，以及失败记录的手动重试。
            当前第一家正式服务商是 Mailgun，公开入口为
            <code style={{ marginLeft: 6 }}>
              /v1/public/email-ingress/providers/mailgun
            </code>
            。
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="nt-btn nt-btn--primary" href={`/ops/account/email-ingress?limit=${limit}`}>
            刷新最近 {limit} 条
          </Link>
          <Link className="nt-btn nt-btn--secondary" href="/ops/account/mailbox">
            查看站内邮箱运营
          </Link>
          <Link className="nt-btn nt-btn--outline" href="/email-access">
            查看用户邮箱入口
          </Link>
        </div>
      </section>

      {params?.status && params?.message ? (
        <NtPanel
          style={{
            display: "grid",
            gap: 8,
            borderColor:
              params.status === "success" ? "rgba(34,197,94,0.22)" : "rgba(244,63,94,0.22)",
            background:
              params.status === "success" ? "rgba(8,39,24,0.7)" : "rgba(39,11,17,0.72)",
          }}
        >
          <span className="nt-kicker">{params.status === "success" ? "操作完成" : "操作失败"}</span>
          <span
            style={{
              color: params.status === "success" ? "#bbf7d0" : "#fecdd3",
              wordBreak: "break-word",
            }}
          >
            {params.message}
          </span>
        </NtPanel>
      ) : null}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
        }}
      >
        <StatCard label="待消费" tone="warning" value={receivedCount} />
        <StatCard label="已处理" tone="success" value={processedCount} />
        <StatCard label="处理失败" tone="danger" value={failedCount} />
        <StatCard label="主链接受" tone="cyan" value={acceptedCount} />
        <StatCard label="主链拒绝" tone="secondary" value={rejectedCount} />
      </section>

      <NtCard style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <NtBadge tone="cyan">公开入口 /v1/public/email-ingress/providers/mailgun</NtBadge>
          <NtBadge tone="glass">内部运维 /v1/internal/email-ingress/provider-messages</NtBadge>
          <NtBadge tone="glass">失败记录允许手动重试</NtBadge>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
            color: "rgba(190,199,217,0.78)",
          }}
        >
          <div>
            <strong style={{ display: "block", marginBottom: 6, color: "rgba(243,245,247,0.92)" }}>
              上线前需要确认
            </strong>
            <span>Mailgun 子域 MX、route expression、webhook 指向 account-api 公网地址均已生效。</span>
          </div>
          <div>
            <strong style={{ display: "block", marginBottom: 6, color: "rgba(243,245,247,0.92)" }}>
              关键环境变量
            </strong>
            <span>
              <code>EMAIL_NATIVE_INGRESS_DOMAIN</code>、<code>ACCOUNT_EMAIL_MAILGUN_SIGNING_KEY</code>、
              <code>ACCOUNT_EMAIL_INGRESS_SIGNATURE_MAX_AGE_SECONDS</code>。
            </span>
          </div>
        </div>
      </NtCard>

      <section style={{ display: "grid", gap: 16 }}>
        {messages.length === 0 ? (
          <NtPanel style={{ display: "grid", gap: 8 }}>
            <span className="nt-kicker">暂无入站记录</span>
            <span style={{ color: "rgba(190,199,217,0.78)" }}>
              当前最近窗口内还没有收到 Mailgun 转发的真实邮件入站。
            </span>
          </NtPanel>
        ) : (
          messages.map((message) => <MessageCard key={message.id} message={message} />)
        )}
      </section>
    </div>
  );
}
