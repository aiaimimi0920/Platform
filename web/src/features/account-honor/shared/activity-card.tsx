/**
 * Activity heatmap card — pure display, no editing.
 * Shared between owner and visitor views.
 */
import { cn } from "@/lib/cn";
import {
  AccountHomeRailCard,
} from "@/components/account-home/templates";
import type { AccountHonorArchiveSectionProps } from "../types";
import { HONOR_ACTIVITY_DAY_LABELS } from "./honor-utils";

type ActivityCardProps = {
  activityHeatmap: AccountHonorArchiveSectionProps["activityHeatmap"];
  className?: string;
};

export function ActivityCard({ activityHeatmap, className }: ActivityCardProps) {
  const monthTrackStyle = {
    gridTemplateColumns: `repeat(${activityHeatmap.weeks.length}, var(--app-honor-heatmap-cell-size, 10px))`,
  };

  return (
    <AccountHomeRailCard className={`app-account-honor-card ${className ?? ""}`}>
      <div className="app-account-honor-activity">
        <div className="app-account-honor-activity__heatmap">
          <div className="app-account-honor-activity__months">
            <span className="app-account-honor-activity__months-corner" />
            <div className="app-account-honor-activity__months-track" style={monthTrackStyle}>
              {activityHeatmap.months.map((marker) => (
                <span
                  className="app-account-honor-activity__month-label"
                  key={marker.key}
                  style={{ gridColumnStart: marker.weekIndex + 1 }}
                >
                  {marker.label}
                </span>
              ))}
            </div>
          </div>

          <div className="app-account-honor-activity__grid-frame">
            <div className="app-account-honor-activity__weekday-axis">
              {HONOR_ACTIVITY_DAY_LABELS.map((entry) => (
                <span
                  className="app-account-honor-activity__weekday-label"
                  key={entry.label}
                  style={{ gridRowStart: entry.row + 1 }}
                >
                  {entry.label}
                </span>
              ))}
            </div>

            <div className="app-account-honor-activity__weeks">
              {activityHeatmap.weeks.map((week) => (
                <div className="app-account-honor-activity__week" key={week.key}>
                  {week.days.map((cell) => (
                    <span
                      className={cn(
                        "app-account-honor-activity__cell",
                        `app-account-honor-activity__cell--level-${cell.level}`,
                        cell.future && "app-account-honor-activity__cell--future",
                      )}
                      key={cell.date}
                      title={cell.title}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AccountHomeRailCard>
  );
}
