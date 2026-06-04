import Link from "next/link";

function AgentIcon() {
  return (
    <svg aria-hidden="true" className="app-honor-trigger__icon" viewBox="0 0 24 24">
      <path
        d="M12 4.5l6 3.2v8.6l-6 3.2-6-3.2V7.7l6-3.2z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M12 8.2v7.6M8.7 10.1l6.6 3.8M15.3 10.1l-6.6 3.8"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function AgentEntry({ routeOpen = false, userId }: { routeOpen?: boolean; userId: string | null }) {
  if (!userId) {
    return null;
  }

  return (
    <Link
      aria-current={routeOpen ? "page" : undefined}
      className="app-agent-trigger"
      href="/agents"
    >
      <span className="app-agent-trigger__copy">
        <AgentIcon />
        <span>{routeOpen ? "智能体中" : "智能体"}</span>
      </span>
    </Link>
  );
}
