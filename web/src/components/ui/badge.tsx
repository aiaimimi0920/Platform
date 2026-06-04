import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

const variantClasses = {
  violet: "mg-badge--violet",
  fuchsia: "mg-badge--fuchsia",
  cyan: "mg-badge--cyan",
  success: "mg-badge--success",
  warning: "mg-badge--warning",
  danger: "mg-badge--danger",
  secondary: "mg-badge--violet",
  glass: "mg-badge--violet",
} as const;

type BadgeVariant = keyof typeof variantClasses;

export function Badge({ className, variant = "violet", ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return <span className={cn("mg-badge", variantClasses[variant], className)} {...props} />;
}
