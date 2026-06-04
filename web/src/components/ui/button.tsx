import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

const variantClasses = {
  primary: "mg-btn--primary",
  secondary: "mg-btn--secondary",
  outline: "mg-btn--outline",
  glass: "mg-btn--glass",
} as const;

type ButtonVariant = keyof typeof variantClasses;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({ className, variant = "primary", type = "button", ...props }: ButtonProps) {
  return <button className={cn("mg-btn", variantClasses[variant], className)} type={type} {...props} />;
}
