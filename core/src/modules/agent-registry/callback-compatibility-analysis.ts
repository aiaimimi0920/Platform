import type {
  AgentCallbackCompatibilitySummaryView,
  AgentCallbackCompatibilityWindowState,
} from "@neuro/contracts";

type CallbackCompatibilityAgentLike = {
  externalCallbackPreviousProtocolVersion: number | null;
  externalCallbackProtocolGraceUntil: Date | string | null;
  externalCallbackPreviousSecretVersion: number | null;
  externalCallbackSecretGraceUntil: Date | string | null;
};

function toDate(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

export function getCallbackCompatibilityWindowState(args: {
  previousVersion: number | null;
  graceUntil: Date | string | null;
  referenceTime?: Date;
}): AgentCallbackCompatibilityWindowState {
  if (!args.previousVersion) {
    return "none";
  }

  const graceUntil = toDate(args.graceUntil);
  if (!graceUntil) {
    return "expired";
  }

  const referenceTime = args.referenceTime ?? new Date();
  return graceUntil.getTime() >= referenceTime.getTime() ? "active" : "expired";
}

function isExpiringWithin24Hours(graceUntil: Date | null, referenceTime: Date) {
  if (!graceUntil) return false;
  const deltaMs = graceUntil.getTime() - referenceTime.getTime();
  return deltaMs >= 0 && deltaMs <= 24 * 60 * 60 * 1000;
}

export function buildAgentCallbackCompatibilitySummary(
  agents: CallbackCompatibilityAgentLike[],
  referenceTime: Date = new Date(),
): AgentCallbackCompatibilitySummaryView {
  let activeProtocolWindowCount = 0;
  let expiredProtocolWindowCount = 0;
  let expiringProtocolWindowCount = 0;
  let activeSecretWindowCount = 0;
  let expiredSecretWindowCount = 0;
  let expiringSecretWindowCount = 0;
  let latestActiveGraceUntil: Date | null = null;
  let latestExpiredAt: Date | null = null;

  for (const agent of agents) {
    const protocolGraceUntil = toDate(agent.externalCallbackProtocolGraceUntil);
    const protocolState = getCallbackCompatibilityWindowState({
      previousVersion: agent.externalCallbackPreviousProtocolVersion,
      graceUntil: protocolGraceUntil,
      referenceTime,
    });
    if (protocolState === "active") {
      activeProtocolWindowCount += 1;
      if (!latestActiveGraceUntil || (protocolGraceUntil && protocolGraceUntil > latestActiveGraceUntil)) {
        latestActiveGraceUntil = protocolGraceUntil;
      }
      if (isExpiringWithin24Hours(protocolGraceUntil, referenceTime)) {
        expiringProtocolWindowCount += 1;
      }
    } else if (protocolState === "expired") {
      expiredProtocolWindowCount += 1;
      if (!latestExpiredAt || (protocolGraceUntil && protocolGraceUntil > latestExpiredAt)) {
        latestExpiredAt = protocolGraceUntil;
      }
    }

    const secretGraceUntil = toDate(agent.externalCallbackSecretGraceUntil);
    const secretState = getCallbackCompatibilityWindowState({
      previousVersion: agent.externalCallbackPreviousSecretVersion,
      graceUntil: secretGraceUntil,
      referenceTime,
    });
    if (secretState === "active") {
      activeSecretWindowCount += 1;
      if (!latestActiveGraceUntil || (secretGraceUntil && secretGraceUntil > latestActiveGraceUntil)) {
        latestActiveGraceUntil = secretGraceUntil;
      }
      if (isExpiringWithin24Hours(secretGraceUntil, referenceTime)) {
        expiringSecretWindowCount += 1;
      }
    } else if (secretState === "expired") {
      expiredSecretWindowCount += 1;
      if (!latestExpiredAt || (secretGraceUntil && secretGraceUntil > latestExpiredAt)) {
        latestExpiredAt = secretGraceUntil;
      }
    }
  }

  return {
    totalExternalAgents: agents.length,
    activeProtocolWindowCount,
    expiredProtocolWindowCount,
    expiringProtocolWindowCount,
    activeSecretWindowCount,
    expiredSecretWindowCount,
    expiringSecretWindowCount,
    latestActiveGraceUntil: latestActiveGraceUntil ? latestActiveGraceUntil.toISOString() : null,
    latestExpiredAt: latestExpiredAt ? latestExpiredAt.toISOString() : null,
  };
}
