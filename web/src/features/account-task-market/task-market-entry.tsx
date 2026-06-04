import Link from "next/link";

function TaskMarketIcon() {
  return (
    <svg aria-hidden="true" className="app-honor-trigger__icon" viewBox="0 0 24 24">
      <path
        d="M6.5 7.2h11v9.6h-11z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M9 10.2h6M9 13.4h4.2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
      <path
        d="M8.2 5.5h7.6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function TaskMarketEntry({ routeOpen = false, userId }: { routeOpen?: boolean; userId: string | null }) {
  if (!userId) {
    return null;
  }

  return (
    <Link
      aria-current={routeOpen ? "page" : undefined}
      className="app-honor-trigger"
      href="/tasks"
    >
      <span className="app-honor-trigger__copy">
        <TaskMarketIcon />
        <span>{routeOpen ? "集市中" : "集市"}</span>
      </span>
    </Link>
  );
}
