/**
 * Six-axis ability radar chart — pure display, no editing.
 * Shared between owner and visitor views.
 */
import type { AccountHonorAbilityMetric } from "../types";
import {
  AccountHomeRailCard,
} from "@/components/account-home/templates";
import {
  HONOR_ABILITY_AXIS_COUNT,
  HONOR_ABILITY_CHART_SIZE,
  HONOR_ABILITY_CENTER,
  HONOR_ABILITY_RADIUS,
  HONOR_ABILITY_COPY_OFFSETS,
  clampMetricScore,
  buildHexPoint,
  buildPolygonPoints,
  buildRingPoints,
  getAbilityLabelAnchor,
} from "./honor-utils";

type AbilityBoardProps = {
  abilityMetrics: AccountHonorAbilityMetric[];
  className?: string;
};

export function AbilityBoard({ abilityMetrics, className }: AbilityBoardProps) {
  const normalizedScores = abilityMetrics.map((metric) => clampMetricScore(metric.score) / 100);
  const abilityShape = buildPolygonPoints(normalizedScores, HONOR_ABILITY_RADIUS);

  return (
    <AccountHomeRailCard className={`app-account-honor-card app-account-honor-card--ability ${className ?? ""}`}>
      <div className="app-account-honor-ability">
        <div className="app-account-honor-ability__chart-wrap">
          <svg
            aria-label="账户六维能力板"
            className="app-account-honor-ability__chart"
            viewBox={`0 0 ${HONOR_ABILITY_CHART_SIZE} ${HONOR_ABILITY_CHART_SIZE}`}
          >
            {[1, 0.75, 0.5, 0.25].map((ratio) => (
              <polygon
                className="app-account-honor-ability__ring"
                key={ratio}
                points={buildRingPoints(ratio)}
              />
            ))}

            {abilityMetrics.map((metric, index) => {
              const axisPoint = buildHexPoint(index, HONOR_ABILITY_RADIUS);
              const copyBasePoint = buildHexPoint(index, HONOR_ABILITY_RADIUS + 18);
              const copyOffset = HONOR_ABILITY_COPY_OFFSETS[index];
              const copyPoint = {
                x: copyBasePoint.x + copyOffset.dx,
                y: copyBasePoint.y + copyOffset.dy,
              };
              const textAnchor = getAbilityLabelAnchor(copyPoint.x);

              return (
                <g key={metric.key}>
                  <line
                    className="app-account-honor-ability__axis"
                    x1={HONOR_ABILITY_CENTER}
                    x2={axisPoint.x}
                    y1={HONOR_ABILITY_CENTER}
                    y2={axisPoint.y}
                  />
                  <text
                    className="app-account-honor-ability__axis-value"
                    textAnchor={textAnchor}
                    x={copyPoint.x}
                    y={copyPoint.y + 6}
                  >
                    {clampMetricScore(metric.score)}
                  </text>
                </g>
              );
            })}

            <polygon className="app-account-honor-ability__shape" points={abilityShape} />

            {abilityMetrics.map((metric, index) => {
              const markerPoint = buildHexPoint(index, HONOR_ABILITY_RADIUS * normalizedScores[index]);
              return (
                <circle
                  className="app-account-honor-ability__point"
                  cx={markerPoint.x}
                  cy={markerPoint.y}
                  key={`${metric.key}-point`}
                  r="4"
                />
              );
            })}
          </svg>
        </div>
      </div>
    </AccountHomeRailCard>
  );
}
