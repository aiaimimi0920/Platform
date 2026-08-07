import { env } from "@/env";
import { requestInternalText } from "@neuro/backend-foundation/platform/internal-request";
import {
  createWorkerHealthState,
  markRecoveredProcessingEvents,
  markWorkerDependency,
  markWorkerCycle,
  startWorkerHealthServer,
} from "@/health";
import { handleEvent } from "@/handlers";
import {
  markEventFailed,
  markEventProcessed,
  pollPendingEvents,
  requeueStaleProcessingEvents,
} from "@/outbox";

type BackgroundLoopState = {
  lastDispatchAt: number;
  lastSettlementAt: number;
  lastMarketplaceSweepAt: number;
  lastPlatformExecutorAt: number;
};

async function callCoreInternal(pathname: string, body: Record<string, unknown>) {
  if (!env.coreInternalUrl || !env.internalApiToken) {
    return null;
  }

  const { response, text } = await requestInternalText(
    `${env.coreInternalUrl.replace(/\/+$/, "")}${pathname}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-api-token": env.internalApiToken,
      },
      body: JSON.stringify(body),
    },
    {
      timeoutMs: env.coreInternalFetchTimeoutMs,
      timeoutMessage: `Internal core call timed out: ${pathname}`,
    },
  );

  if (!response.ok) {
    throw new Error(`Internal core call failed: ${pathname} ${response.status} ${text}`.trim());
  }

  return text.trim() ? text : null;
}

async function runBackgroundLoops(
  healthState: ReturnType<typeof createWorkerHealthState>,
  loopState: BackgroundLoopState,
) {
  if (!env.coreInternalUrl || !env.internalApiToken) {
    return;
  }

  const currentTime = Date.now();

  if (currentTime - loopState.lastDispatchAt >= env.agentExecutionDispatchIntervalMs) {
    loopState.lastDispatchAt = currentTime;
    try {
      await callCoreInternal("/v1/internal/agent-executions/dispatch-pending", {
        limit: env.agentExecutionDispatchLimit,
      });
      markWorkerDependency(healthState, "core-dispatch", "success");
    } catch (error) {
      console.error("Worker failed to dispatch pending agent executions", error);
      markWorkerDependency(healthState, "core-dispatch", "error", extractErrorMessage(error));
    }
  }

  if (currentTime - loopState.lastPlatformExecutorAt >= env.platformExecutorIntervalMs) {
    loopState.lastPlatformExecutorAt = currentTime;
    try {
      await callCoreInternal("/v1/internal/agent-executions/run-platform-executor", {
        limit: env.platformExecutorLimit,
      });
      markWorkerDependency(healthState, "core-platform-executor", "success");
    } catch (error) {
      console.error("Worker failed to run platform executor loop", error);
      markWorkerDependency(healthState, "core-platform-executor", "error", extractErrorMessage(error));
    }
  }

  if (currentTime - loopState.lastSettlementAt >= env.agentExecutionSettlementIntervalMs) {
    loopState.lastSettlementAt = currentTime;
    try {
      await callCoreInternal("/v1/internal/agent-executions/settlements/run", {
        limit: env.agentExecutionSettlementLimit,
      });
      markWorkerDependency(healthState, "core-settlements", "success");
    } catch (error) {
      console.error("Worker failed to run agent execution settlements", error);
      markWorkerDependency(healthState, "core-settlements", "error", extractErrorMessage(error));
    }
  }

  if (currentTime - loopState.lastMarketplaceSweepAt >= env.agentMarketplaceSweepIntervalMs) {
    loopState.lastMarketplaceSweepAt = currentTime;
    try {
      await callCoreInternal("/v1/internal/agents/marketplace/auto-proposals/sweep-all", {
        ownerLimit: env.agentMarketplaceSweepOwnerLimit,
        perOwnerLimit: env.agentMarketplaceSweepPerOwnerLimit,
      });
      markWorkerDependency(healthState, "core-marketplace-sweep", "success");
    } catch (error) {
      console.error("Worker failed to sweep agent marketplace auto proposals", error);
      markWorkerDependency(healthState, "core-marketplace-sweep", "error", extractErrorMessage(error));
    }
  }
}

async function cycle(
  healthState: ReturnType<typeof createWorkerHealthState>,
  loopState: BackgroundLoopState,
) {
  const recovered = await requeueStaleProcessingEvents(env.processingLeaseTimeoutMs);
  markRecoveredProcessingEvents(healthState, recovered);
  if (recovered.requeuedCount > 0 || recovered.deadLetterCount > 0) {
    console.warn(
      `Recovered stale processing events: requeued=${recovered.requeuedCount}, deadLetter=${recovered.deadLetterCount}`,
    );
  }

  const events = await pollPendingEvents();
  for (const event of events) {
    try {
      const result = await handleEvent(event.eventName, event.payload);
      if (result === "processed") {
        await markEventProcessed(event.id);
      } else {
        await markEventFailed(event.id, event.attempts, event.maxAttempts, "handler deferred processing");
      }
    } catch (error) {
      console.error(`Worker failed to process ${event.eventName}`, error);
      await markEventFailed(event.id, event.attempts, event.maxAttempts, extractErrorMessage(error));
    }
  }

  await runBackgroundLoops(healthState, loopState);
}

async function main() {
  const healthState = createWorkerHealthState(env.processingLeaseTimeoutMs, env.pollIntervalMs);
  const loopState: BackgroundLoopState = {
    lastDispatchAt: 0,
    lastSettlementAt: 0,
    lastMarketplaceSweepAt: 0,
    lastPlatformExecutorAt: 0,
  };
  startWorkerHealthServer(env.healthPort, healthState);
  console.log(
    `Worker started with outbox and agent loops. Poll interval: ${env.pollIntervalMs}ms. Processing lease timeout: ${env.processingLeaseTimeoutMs}ms`,
  );

  while (true) {
    try {
      await cycle(healthState, loopState);
      markWorkerCycle(healthState, "success");
    } catch (error) {
      const message = extractErrorMessage(error) ?? "unknown worker loop failure";
      console.error("Worker cycle failed", error);
      markWorkerCycle(healthState, "error", message);
    }
    await new Promise((resolve) => setTimeout(resolve, env.pollIntervalMs));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

function extractErrorMessage(reason: unknown): string | undefined {
  if (!reason) return undefined;
  if (typeof reason === "string") return reason;
  if (reason instanceof Error && reason.message) return reason.message;
  if (typeof reason === "object" && reason !== null && "message" in reason) {
    const message = (reason as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  try {
    return JSON.stringify(reason);
  } catch {
    return undefined;
  }
}
