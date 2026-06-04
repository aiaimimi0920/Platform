import type { CSSProperties } from "react";

export function buildOpinionToggleStyle(active: boolean, tone: "default" | "cool" = "default"): CSSProperties {
  if (active) {
    return {
      borderColor: "rgba(255,255,255,0.18)",
      background:
        "linear-gradient(180deg, rgba(249,250,251,0.98), rgba(233,236,240,0.96)), rgba(244,246,248,0.98)",
      color: "#101419",
      boxShadow: "0 18px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.84)",
    };
  }

  return {
    borderColor: tone === "cool" ? "rgba(78,201,255,0.28)" : "rgba(255,255,255,0.08)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)), rgba(10,13,17,0.74)",
    color: tone === "cool" ? "rgba(214,245,255,0.94)" : "rgba(230,236,241,0.86)",
    boxShadow: "none",
  };
}

export function buildOpinionTagDropdownStyle(active: boolean): CSSProperties {
  if (active) {
    return {
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      minHeight: 46,
      padding: "0 16px",
      borderRadius: 18,
      border: "1px solid rgba(255,255,255,0.18)",
      background:
        "linear-gradient(180deg, rgba(249,250,251,0.98), rgba(233,236,240,0.96)), rgba(244,246,248,0.98)",
      color: "#101419",
      boxShadow: "0 12px 24px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.84)",
      whiteSpace: "nowrap",
      fontSize: "0.84rem",
      fontWeight: 700,
      cursor: "pointer",
      listStyle: "none",
      userSelect: "none",
    };
  }

  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    minHeight: 46,
    padding: "0 16px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)), rgba(10,13,17,0.74)",
    color: "rgba(230,236,241,0.86)",
    boxShadow: "none",
    whiteSpace: "nowrap",
    fontSize: "0.84rem",
    fontWeight: 700,
    cursor: "pointer",
    listStyle: "none",
    userSelect: "none",
  };
}

export function buildOpinionTerminalActionStyle(disabled: boolean): CSSProperties {
  return {
    minHeight: 60,
    paddingInline: 28,
    borderRadius: 22,
    border: disabled ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(217,255,56,0.22)",
    background: disabled
      ? "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02)), rgba(12,15,20,0.68)"
      : "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03)), rgba(16,18,22,0.94)",
    color: disabled ? "rgba(225,231,236,0.42)" : "rgba(244,248,252,0.94)",
    boxShadow: disabled ? "none" : "0 14px 26px rgba(0,0,0,0.24)",
    fontWeight: 800,
    letterSpacing: "0.02em",
  };
}

export function buildOpinionDetailMetricStyle(): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    minHeight: 48,
    padding: "8px 12px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015)), rgba(16,19,24,0.88)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
    alignContent: "center",
  };
}

export function buildOpinionVoteButtonStyle(active: boolean): CSSProperties {
  return {
    display: "inline-grid",
    placeItems: "center",
    width: 30,
    height: 30,
    minHeight: 30,
    padding: 0,
    borderRadius: 10,
    border: active ? "1px solid rgba(217,255,56,0.28)" : "1px solid rgba(255,255,255,0.08)",
    background: active
      ? "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03)), rgba(16,18,22,0.94)"
      : "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02)), rgba(10,13,17,0.74)",
    color: active ? "rgba(217,255,56,0.92)" : "rgba(232,238,242,0.88)",
    boxShadow: active ? "0 12px 20px rgba(0,0,0,0.22)" : "none",
  };
}

export function buildOpinionDiscussionReplyStyle(): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    minHeight: 0,
    padding: 0,
    border: "none",
    background: "transparent",
    color: "rgba(214,220,225,0.72)",
    fontSize: "0.82rem",
    fontWeight: 700,
    lineHeight: 1.2,
    textDecoration: "none",
    boxShadow: "none",
  };
}
