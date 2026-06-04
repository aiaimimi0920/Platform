import { logoutWithLinuxDo } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={logoutWithLinuxDo}>
      <Button className={className} type="submit" variant="glass">
        退出登录
      </Button>
    </form>
  );
}
