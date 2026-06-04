import type { ComponentPropsWithoutRef, PropsWithChildren } from "react";

import { cn } from "@/lib/cn";

export type NtBadgeTone =
  | "violet"
  | "fuchsia"
  | "cyan"
  | "success"
  | "warning"
  | "danger"
  | "secondary"
  | "glass";

const badgeToneClass: Record<NtBadgeTone, string> = {
  violet: "nt-chip--violet",
  fuchsia: "nt-chip--fuchsia",
  cyan: "nt-chip--cyan",
  success: "nt-chip--success",
  warning: "nt-chip--warning",
  danger: "nt-chip--danger",
  secondary: "nt-chip--muted",
  glass: "nt-chip--glass",
};

type NtCardProps = ComponentPropsWithoutRef<"div">;
type NtPanelProps = ComponentPropsWithoutRef<"section">;

export function NtBadge({
  children,
  className,
  tone = "glass",
  variant,
}: PropsWithChildren<{ className?: string; tone?: NtBadgeTone; variant?: NtBadgeTone }>) {
  const resolvedTone = variant ?? tone;
  return <span className={cn("nt-chip", badgeToneClass[resolvedTone], className)}>{children}</span>;
}

export function NtCard({ children, className, ...props }: NtCardProps) {
  return (
    <div className={cn("nt-card", className)} {...props}>
      {children}
    </div>
  );
}

export function NtPanel({ children, className, ...props }: NtPanelProps) {
  return (
    <section className={cn("nt-panel", className)} {...props}>
      {children}
    </section>
  );
}

export function NtInput({ className, ...props }: ComponentPropsWithoutRef<"input">) {
  return <input className={cn("nt-input", className)} {...props} />;
}

export function NtSelect({ className, ...props }: ComponentPropsWithoutRef<"select">) {
  return <select className={cn("nt-select", className)} {...props} />;
}

export function NtTextarea({ className, ...props }: ComponentPropsWithoutRef<"textarea">) {
  return <textarea className={cn("nt-textarea", className)} {...props} />;
}
