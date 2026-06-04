"use client";

import type { OpinionTopicTag } from "@neuro/contracts";

import { OpinionPanelIcon } from "./icons";
import { OPINION_TOPIC_TAG_OPTIONS } from "./constants";
import { buildOpinionToggleStyle } from "./styles";
import "./styles.css";

export interface OpinionCenterPanelProps {
  highlightTag?: OpinionTopicTag | null;
}

export function OpinionCenterPanel({ highlightTag = null }: OpinionCenterPanelProps) {
  return (
    <section className="mg-terminal-section account-opinion-center-shell" aria-label="议题中心占位">
      <header className="account-opinion-center-shell__header">
        <div className="app-honor__rail-mark" aria-hidden="true">
          <OpinionPanelIcon />
        </div>
        <div>
          <p className="mg-terminal-kicker">议题中心</p>
          <h3 className="mg-card__title" style={{ margin: 0 }}>
            {highlightTag ? `聚焦：${highlightTag}` : "待跳转面板"}
          </h3>
        </div>
      </header>

      <p className="mg-copy">
        该组件即将承载议题列表、投票与讨论入口，目前仅保留标签热区供未来路由解耦使用。
      </p>

      <div className="mg-terminal-rail-card account-opinion-center-shell__tag-grid">
        {OPINION_TOPIC_TAG_OPTIONS.map((tag) => (
          <button
            key={tag.key}
            type="button"
            className="mg-btn mg-btn--glass"
            style={buildOpinionToggleStyle(tag.key === highlightTag, tag.key === "performance" ? "cool" : "default")}
          >
            {tag.label}
          </button>
        ))}
      </div>
    </section>
  );
}
