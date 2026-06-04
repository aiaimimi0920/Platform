import { Badge } from "@/components/ui/badge";

export function VoteUpIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      style={{ display: "block", width: 16, height: 16, overflow: "visible" }}
    >
      <path
        d="M10.5 10.2V5.9c0-1.2.7-2.3 1.8-2.8l.3-.1.4.3c.6.5.9 1.3.9 2.1v2.9h3.2c1.6 0 2.7 1.6 2.2 3.1l-1.3 4.4a2.4 2.4 0 0 1-2.3 1.7h-5.2c-.8 0-1.6-.4-2.1-1l-1.4-1.7V10.2h3.5Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M4.5 10.2h2.6v7.2H4.5z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function VoteDownIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      style={{ display: "block", width: 16, height: 16, overflow: "visible" }}
    >
      <path
        d="M10.5 13.8v4.3c0 1.2.7 2.3 1.8 2.8l.3.1.4-.3c.6-.5.9-1.3.9-2.1v-2.9h3.2c1.6 0 2.7-1.6 2.2-3.1l-1.3-4.4a2.4 2.4 0 0 0-2.3-1.7h-5.2c-.8 0-1.6.4-2.1 1l-1.4 1.7v4.6h3.5Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M4.5 6.6h2.6v7.2H4.5z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg aria-hidden="true" className="app-honor-close__icon" viewBox="0 0 24 24">
      <path
        d="M6 6 18 18M18 6 6 18"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function OpinionPanelIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M5.5 7.5h13v9h-13z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M8.5 10.5h7M8.5 13.5h4.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M8 5.5h8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function OpinionToneBadge({ label }: { label: string }) {
  const variant =
    label === "已采纳"
      ? "success"
      : label === "已归档" || label === "待审核"
      ? "warning"
      : label === "已驳回" || label === "已封禁" || label === "已删除"
      ? "danger"
      : "violet";

  return <Badge variant={variant as "success" | "warning" | "danger" | "violet"}>{label}</Badge>;
}
