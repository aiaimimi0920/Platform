"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

type AnnouncementRailTitleProps = {
  title: string;
};

export function AnnouncementRailTitle({ title }: AnnouncementRailTitleProps) {
  const titleRef = useRef<HTMLElement | null>(null);
  const [multiline, setMultiline] = useState(false);

  useEffect(() => {
    const titleElement = titleRef.current;

    if (!titleElement) {
      return;
    }

    let frameId = 0;

    const syncMultilineState = () => {
      frameId = window.requestAnimationFrame(() => {
        const computedStyle = window.getComputedStyle(titleElement);
        const lineHeight = Number.parseFloat(computedStyle.lineHeight);
        const fallbackLineHeight = Number.parseFloat(computedStyle.fontSize) * 1.15;
        const singleLineHeight = Number.isFinite(lineHeight) ? lineHeight : fallbackLineHeight;
        setMultiline(titleElement.scrollHeight > singleLineHeight * 1.35);
      });
    };

    syncMultilineState();

    const resizeObserver = new ResizeObserver(() => {
      syncMultilineState();
    });

    resizeObserver.observe(titleElement);
    window.addEventListener("resize", syncMultilineState);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", syncMultilineState);
      resizeObserver.disconnect();
    };
  }, [title]);

  return (
    <strong className={cn(multiline && "app-announcement__item-title--multiline")} ref={titleRef}>
      {title}
    </strong>
  );
}
