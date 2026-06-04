import type { PropsWithChildren } from "react";

import { cn } from "@/lib/cn";

type AlertVariant = "info" | "success" | "warning" | "danger";

export function Alert({
  title,
  variant = "info",
  className,
  children,
}: PropsWithChildren<{ title: string; variant?: AlertVariant; className?: string }>) {
  return (
    <div className={cn("mg-alert", `mg-alert--${variant}`, className)}>
      <div className="mg-alert__title">{title}</div>
      <div className="mg-alert__body">{children}</div>
    </div>
  );
}
