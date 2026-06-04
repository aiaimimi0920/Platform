"use client";

import Link from "next/link";

function ProjectIcon() {
  return (
    <svg aria-hidden="true" className="app-benefit-trigger__icon" viewBox="0 0 24 24">
      <path
        d="M5.5 7.5h13v10h-13z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M8.5 5.5h7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
      <path
        d="M8.5 11h7M8.5 14.5h4.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function ProjectEntry({ routeOpen = false, userId }: { routeOpen?: boolean; userId: string | null }) {
  if (!userId) {
    return null;
  }

  return (
    <Link aria-current={routeOpen ? "page" : undefined} className="app-benefit-trigger" href="/projects">
      <span className="app-benefit-trigger__copy">
        <ProjectIcon />
        <span>{routeOpen ? "项目中" : "项目"}</span>
      </span>
    </Link>
  );
}
