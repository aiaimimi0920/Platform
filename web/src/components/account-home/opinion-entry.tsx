"use client";

import Link from "next/link";

type OpinionEntryProps = {
  enabled: boolean;
  routeOpen?: boolean;
  userId: string | null;
};

function OpinionIcon() {
  return (
    <svg aria-hidden="true" className="app-redeem-trigger__icon" viewBox="0 0 24 24">
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

export function OpinionEntry({ enabled, routeOpen = false, userId }: OpinionEntryProps) {
  if (!enabled || !userId) {
    return null;
  }

  return (
    <Link
      aria-current={routeOpen ? "page" : undefined}
      className="app-redeem-trigger"
      href="/opinions"
    >
      <span className="app-redeem-trigger__copy">
        <OpinionIcon />
        <span>{routeOpen ? "议题中" : "议题"}</span>
      </span>
    </Link>
  );
}
