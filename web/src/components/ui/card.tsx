import type { HTMLAttributes, PropsWithChildren } from "react";

import { cn } from "@/lib/cn";

export function Card({ className, children, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={cn("mg-card", className)} {...props}>
      {children}
    </div>
  );
}

export function Panel({ className, children, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={cn("mg-panel", className)} {...props}>
      {children}
    </div>
  );
}
