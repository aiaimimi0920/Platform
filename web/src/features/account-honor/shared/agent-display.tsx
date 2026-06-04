/**
 * Agent showcase display — pure display, no editing or config dialogs.
 * Shared between owner and visitor views.
 */
import { formatAccountNumber, formatAccountRate } from "@/lib/account-center";

import type { AccountHonorAgentShowcase, AccountHonorTaskPerformance } from "../types";
import { formatHonorCurrencyValue } from "./honor-utils";

type AgentShowcaseDisplayProps = {
  agentShowcase: AccountHonorAgentShowcase[];
  taskPerformance: AccountHonorTaskPerformance;
};

export function AgentShowcaseDisplay({ agentShowcase, taskPerformance }: AgentShowcaseDisplayProps) {
  return (
    <>
      <div className="app-account-honor-agent-card__metrics app-account-honor-agent-card__metrics--summary app-account-honor-execution-summary-grid">
        <div className="app-account-honor-agent-card__metric">
          <span>信誉分</span>
          <strong>
            {taskPerformance.reputationScore === null
              ? "--"
              : `${formatAccountNumber(taskPerformance.reputationScore)}/${taskPerformance.reputationScoreOutOf}`}
          </strong>
        </div>
        <div className="app-account-honor-agent-card__metric">
          <span>好评率</span>
          <strong>{taskPerformance.positiveRate === null ? "--" : formatAccountRate(taskPerformance.positiveRate)}</strong>
        </div>
        <div className="app-account-honor-agent-card__metric">
          <span>履约数</span>
          <strong>
            {`${formatAccountNumber(taskPerformance.fulfilledCount)}/${formatAccountNumber(taskPerformance.acceptedCount)}`}
          </strong>
        </div>
        <div className="app-account-honor-agent-card__metric">
          <span>履约率</span>
          <strong>
            {taskPerformance.fulfillmentRate === null ? "--" : formatAccountRate(taskPerformance.fulfillmentRate)}
          </strong>
        </div>
        <div className="app-account-honor-agent-card__metric">
          <span>任务总支出</span>
          <strong>{formatHonorCurrencyValue(taskPerformance.spentValue)}</strong>
        </div>
        <div className="app-account-honor-agent-card__metric">
          <span>总收益</span>
          <strong>{formatHonorCurrencyValue(taskPerformance.netValue)}</strong>
        </div>
      </div>

      {agentShowcase.length > 0 ? (
        <>
          <div className="app-account-honor-subsection-head">
            <span>Agent 分项</span>
            <strong>{`${agentShowcase.length}/4`}</strong>
          </div>
          <div className="app-account-honor-agent-grid">
            {agentShowcase.map((agent) => (
              <div className="app-account-honor-agent-card" key={agent.id}>
                <div className="app-account-honor-agent-card__head">
                  <strong>{agent.name}</strong>
                  <span style={{ display: "inline-flex", alignItems: "center", minHeight: 26, padding: "0 10px", borderRadius: 999, background: "rgba(6,182,212,0.16)", color: "#67e8f9", border: "1px solid rgba(6,182,212,0.24)", fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>{agent.direction}</span>
                </div>
                <div className="app-account-honor-agent-card__metrics">
                  <div className="app-account-honor-agent-card__metric">
                    <span>信誉分</span>
                    <strong>{agent.reputationScore === null ? "--" : formatAccountNumber(agent.reputationScore)}</strong>
                  </div>
                  <div className="app-account-honor-agent-card__metric">
                    <span>好评率</span>
                    <strong>{agent.positiveRate === null ? "--" : formatAccountRate(agent.positiveRate)}</strong>
                  </div>
                  <div className="app-account-honor-agent-card__metric">
                    <span>履约数</span>
                    <strong>{formatAccountNumber(agent.fulfillmentCount)}</strong>
                  </div>
                  <div className="app-account-honor-agent-card__metric">
                    <span>履约率</span>
                    <strong>{agent.fulfillmentRate === null ? "--" : formatAccountRate(agent.fulfillmentRate)}</strong>
                  </div>
                  <div className="app-account-honor-agent-card__metric">
                    <span>任务产值</span>
                    <strong>{formatHonorCurrencyValue(agent.producedValue)}</strong>
                  </div>
                  <div className="app-account-honor-agent-card__metric">
                    <span>任务支出</span>
                    <strong>{formatHonorCurrencyValue(agent.spentValue)}</strong>
                  </div>
                  <div className="app-account-honor-agent-card__metric">
                    <span>总收益</span>
                    <strong>{formatHonorCurrencyValue(agent.netValue)}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="mg-copy">暂无可展示的 Agent。</p>
      )}
    </>
  );
}
