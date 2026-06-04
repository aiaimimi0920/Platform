import Link from "next/link";

function HeavyChatIcon() {
  return (
    <svg aria-hidden="true" style={{ width: 16, height: 16 }} viewBox="0 0 24 24">
      <path
        d="M6 7.5h12M6 12h8m-8 4.5h6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="M7 4.5h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H11l-4 2.6v-2.6H7a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function HeavyAgentChatEntry({
  routeOpen = false,
  userId,
}: {
  routeOpen?: boolean;
  userId: string | null;
}) {
  if (!userId) {
    return null;
  }

  return (
    <Link
      aria-current={routeOpen ? "page" : undefined}
      className="nt-btn nt-btn--secondary"
      href="/chat"
      style={{ gap: 8 }}
    >
      <HeavyChatIcon />
      <span>{routeOpen ? "对话中" : "对话"}</span>
    </Link>
  );
}
