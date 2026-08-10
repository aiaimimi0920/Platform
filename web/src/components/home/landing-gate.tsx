"use client";

import type { ReactNode } from "react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/cn";

const READY_PROGRESS = 25;
const FILL_PROGRESS = 18;
const RESUME_COOKIE = "nl_landing_resume";
export const LANDING_GATE_INITIAL_VIEWPORT_WIDTH = 1440;

export function resolveLandingGateReadyWidthPx(viewportWidth: number): number {
  return Math.min(Math.max(viewportWidth * 0.25, 340), Math.max(viewportWidth - 24, 32));
}

type LandingGateProps = {
  actionSlot: ReactNode;
  authenticated?: boolean;
  resumeFromReady?: boolean;
  successTarget?: string;
  terminalUid: string;
};

type RevealPhase = "idle" | "fill" | "expand" | "ready" | "handoff" | "success";

export function LandingGate({
  actionSlot,
  authenticated = false,
  resumeFromReady = false,
  successTarget = "/dashboard",
  terminalUid,
}: LandingGateProps) {
  const initialPhase: RevealPhase = resumeFromReady && authenticated ? "ready" : "idle";
  const initialProgress = resumeFromReady && authenticated ? READY_PROGRESS : 0;
  const directAuthenticatedHandoff = authenticated && !resumeFromReady;
  const resumeAuthenticatedReturn = resumeFromReady && authenticated;
  const [phase, setPhase] = useState<RevealPhase>(initialPhase);
  const [progress, setProgress] = useState(initialProgress);
  const router = useRouter();
  const progressRef = useRef(initialProgress);
  const frameRef = useRef<number | null>(null);
  const [viewportWidth, setViewportWidth] = useState(LANDING_GATE_INITIAL_VIEWPORT_WIDTH);

  const progressValue = Math.round(progress);
  const entryMotionStyle = useMemo(() => {
    const readyWidthPx = resolveLandingGateReadyWidthPx(viewportWidth);
    const fillScale =
      phase === "idle"
        ? 0
        : phase === "fill"
          ? Math.max(0, Math.min(progress / FILL_PROGRESS, 1))
          : 1;
    const statusOnSignalField = phase === "ready" || phase === "success" || progress >= 22;
    const style: Record<string, string> = {
      "--entry-bar-width": "32px",
      "--entry-ready-width": `${readyWidthPx}px`,
      "--entry-bar-clip": "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
      "--entry-bar-filter": "none",
      "--entry-fill-scale": fillScale.toFixed(4),
      "--entry-panel-opacity": "0",
      "--entry-panel-blur": "16px",
      "--entry-panel-scale": "0.98",
      "--entry-panel-visibility": "visible",
      "--entry-panel-offset": "42px",
      "--entry-panel-mobile-offset": "28px",
      "--entry-panel-mobile-scale": "0.985",
      "--entry-panel-pointer": "auto",
      "--entry-status-mark-bg": "var(--neuro-signal-yellow)",
      "--entry-status-mark-shadow": "0 0 18px var(--neuro-yellow-line)",
      "--entry-status-value-color": "var(--neuro-signal-yellow)",
      "--entry-status-label-color": "var(--neuro-text-muted)",
    };

    if (statusOnSignalField) {
      style["--entry-status-mark-bg"] = "var(--neuro-focus-ink)";
      style["--entry-status-mark-shadow"] = "none";
      style["--entry-status-value-color"] = "var(--neuro-on-yellow)";
      style["--entry-status-label-color"] = "var(--neuro-focus-ink)";
    }

    if (phase === "expand" || phase === "ready") {
      style["--entry-bar-width"] = `${readyWidthPx}px`;
      style["--entry-bar-filter"] = phase === "ready" ? "saturate(1.02)" : "none";
      style["--entry-panel-opacity"] = "1";
      style["--entry-panel-blur"] = "0px";
      style["--entry-panel-scale"] = "1";
      style["--entry-panel-offset"] = "0px";
      style["--entry-panel-mobile-offset"] = "0px";
      style["--entry-panel-mobile-scale"] = "1";
    }

    if (phase === "handoff") {
      style["--entry-bar-width"] = "100vw";
      style["--entry-bar-filter"] = "saturate(1.02)";
      style["--entry-fill-scale"] = "1";
      style["--entry-panel-opacity"] = "0";
      style["--entry-panel-blur"] = "10px";
      style["--entry-panel-scale"] = "0.96";
      style["--entry-panel-visibility"] = "hidden";
      style["--entry-panel-offset"] = "0px";
      style["--entry-panel-mobile-offset"] = "0px";
      style["--entry-panel-mobile-scale"] = "0.96";
      style["--entry-panel-pointer"] = "none";
    }

    if (phase === "success") {
      const successRate = Math.min(Math.max((progress - READY_PROGRESS) / (100 - READY_PROGRESS), 0), 1);
      const successWidthPx = readyWidthPx + (viewportWidth - readyWidthPx) * successRate;
      style["--entry-bar-width"] = `${successWidthPx}px`;
      style["--entry-bar-filter"] = "saturate(1.02)";
      style["--entry-panel-opacity"] = "0";
      style["--entry-panel-blur"] = "10px";
      style["--entry-panel-scale"] = "0.96";
      style["--entry-panel-visibility"] = "hidden";
      style["--entry-panel-offset"] = "0px";
      style["--entry-panel-mobile-offset"] = "0px";
      style["--entry-panel-mobile-scale"] = "0.96";
      style["--entry-panel-pointer"] = "none";
    }

    return style as CSSProperties;
  }, [phase, progress, viewportWidth]);

  useEffect(() => {
    const syncViewportWidth = () => {
      setViewportWidth(window.innerWidth);
    };

    syncViewportWidth();
    window.addEventListener("resize", syncViewportWidth);

    return () => {
      window.removeEventListener("resize", syncViewportWidth);
    };
  }, []);

  const progressLabel = useMemo(() => {
    if (resumeAuthenticatedReturn && phase === "ready") {
      return "Access granted...";
    }
    if (phase === "handoff" || phase === "success") {
      return "Access granted...";
    }
    if (phase === "ready" && authenticated) {
      return "Credential confirmed...";
    }
    if (phase === "ready") {
      return "Awaiting authorization...";
    }
    if (phase === "expand") {
      return "Extending access lane...";
    }
    return "Initializing access gate...";
  }, [authenticated, phase, resumeAuthenticatedReturn]);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    const clearResumeCookie = () => {
      document.cookie = `${RESUME_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
    };

    const animateProgress = (target: number, duration: number) => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }

      const startValue = progressRef.current;
      const startTime = window.performance.now();

      const tick = (now: number) => {
        const elapsed = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - elapsed, 3);
        const nextValue = startValue + (target - startValue) * eased;
        progressRef.current = nextValue;
        setProgress(nextValue);
        if (elapsed < 1) {
          frameRef.current = window.requestAnimationFrame(tick);
        }
      };

      frameRef.current = window.requestAnimationFrame(tick);
    };

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (resumeFromReady || !authenticated) {
      clearResumeCookie();
    }
    if (media.matches) {
      setPhase(authenticated ? "success" : "ready");
      progressRef.current = authenticated ? 100 : READY_PROGRESS;
      setProgress(authenticated ? 100 : READY_PROGRESS);
      if (authenticated) {
        router.replace(successTarget);
      }
      return;
    }

    let rafTimer: number | null = null;
    let resumeTimer: number | null = null;
    let expandTimer: number | null = null;
    let readyTimer: number | null = null;
    let successTimer: number | null = null;
    let routeTimer: number | null = null;

    const beginStandardSequence = () => {
      setPhase("idle");
      progressRef.current = 0;
      setProgress(0);

      rafTimer = window.requestAnimationFrame(() => {
        setPhase("fill");
        animateProgress(FILL_PROGRESS, 920);
      });

      expandTimer = window.setTimeout(() => {
        setPhase("expand");
        animateProgress(READY_PROGRESS, 760);
      }, 960);

      if (authenticated) {
        successTimer = window.setTimeout(() => {
          setPhase("success");
          progressRef.current = READY_PROGRESS;
          setProgress(READY_PROGRESS);
          animateProgress(100, 860);
        }, 1720);

        routeTimer = window.setTimeout(() => {
          router.replace(successTarget);
        }, 2580);
      } else {
        readyTimer = window.setTimeout(() => {
          setPhase("ready");
          progressRef.current = READY_PROGRESS;
          setProgress(READY_PROGRESS);
        }, 1720);
      }
    };

    const beginAuthenticatedHandoff = () => {
      setPhase("handoff");
      progressRef.current = 100;
      setProgress(100);

      routeTimer = window.setTimeout(() => {
        router.replace(successTarget);
      }, 980);
    };

    const beginResumeSequence = () => {
      setPhase("ready");
      progressRef.current = READY_PROGRESS;
      setProgress(READY_PROGRESS);

      resumeTimer = window.setTimeout(() => {
        setPhase("success");
        animateProgress(100, 860);
      }, 32);

      routeTimer = window.setTimeout(() => {
        router.replace(successTarget);
      }, 980);
    };

    if (resumeFromReady && authenticated) {
      beginResumeSequence();
    } else if (authenticated) {
      beginAuthenticatedHandoff();
    } else {
      beginStandardSequence();
    }

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
      if (rafTimer !== null) {
        window.cancelAnimationFrame(rafTimer);
      }
      if (resumeTimer !== null) {
        window.clearTimeout(resumeTimer);
      }
      if (expandTimer !== null) {
        window.clearTimeout(expandTimer);
      }
      if (readyTimer !== null) {
        window.clearTimeout(readyTimer);
      }
      if (successTimer !== null) {
        window.clearTimeout(successTimer);
      }
      if (routeTimer !== null) {
        window.clearTimeout(routeTimer);
      }
    };
  }, [authenticated, resumeFromReady, router, successTarget]);

  return (
    <main className="app-entry-page">
      <section
        className={cn(
          "app-entry",
          `app-entry--${phase}`,
          resumeAuthenticatedReturn && "app-entry--resume-auth",
          directAuthenticatedHandoff && "app-entry--direct-auth",
        )}
        style={entryMotionStyle}
      >
        <div className="app-entry__noise" aria-hidden="true" />
        <div className="app-entry__grid" aria-hidden="true" />
        <div className="app-entry__topography" aria-hidden="true" />
        <div className="app-entry__signal-bar" aria-hidden="true">
          <span className="app-entry__signal-bar-fill" />
          <span className="app-entry__signal-bar-sheen" />
        </div>
        <div className="app-entry__scan" aria-hidden="true" />
        <div className="app-entry__status" aria-live="polite">
          <span className="app-entry__status-mark" aria-hidden="true" />
          <strong className="app-entry__status-value">{progressValue}%</strong>
          <span className="app-entry__status-label">{progressLabel}</span>
          <span className="app-entry__status-uid">UID: {terminalUid}</span>
        </div>

        <div className="app-entry__intro" aria-hidden="true">
          <div className="app-entry__brand-stack">
            <strong className="app-entry__brand-wordmark">NEUROLOOM</strong>
          </div>
        </div>

        <div className="app-entry__panel">
          <div className="app-entry__panel-head">
            <div className="app-entry__panel-brand">
              <span className="app-entry__panel-brand-mark">N</span>
              <strong className="app-entry__panel-brand-name">NeuroLoom</strong>
            </div>
            <span className="app-entry__panel-glyph" aria-hidden="true" />
          </div>

          <div className="app-entry__panel-body">
            <div className="app-entry__panel-ornament" aria-hidden="true" />
            <div className="app-entry__actions">{actionSlot}</div>
          </div>
        </div>
      </section>
    </main>
  );
}
