"use client";

import { loginWithLinuxDo, loginWithLocalDev } from "@/lib/auth-actions";
import { useCallback } from "react";

import { Button } from "@/components/ui/button";

const LANDING_RESUME_COOKIE = "nl_landing_resume";

export function SignInButton({
  className,
  mode = "linuxdo",
  label,
}: {
  className?: string;
  mode?: "linuxdo" | "local-dev";
  label?: string;
}) {
  const markResumeTransition = useCallback(() => {
    document.cookie = `${LANDING_RESUME_COOKIE}=1; Max-Age=600; Path=/; SameSite=Lax`;
  }, []);
  const action = mode === "local-dev" ? loginWithLocalDev : loginWithLinuxDo;
  const text = label || (mode === "local-dev" ? "使用本地开发账号登录" : "使用 Linux Do 登录");
  return (
    <form action={action} onSubmit={markResumeTransition}>
      <Button className={className} type="submit" variant="primary">
        {text}
      </Button>
    </form>
  );
}
