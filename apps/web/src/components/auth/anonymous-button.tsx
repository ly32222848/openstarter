// 匿名登录入口：创建临时游客会话（better-auth anonymousClient）。
// 供未注册访客先体验再落库；游客在 Accounts 页可后续 Link 正式账号。
// 由 anonymous 开关（Config `anonymous_auth_enabled`）控制是否渲染。

import { Button } from "@openstarter/ui-web/components/button";
import { Ghost } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { m } from "@/paraglide/messages.js";

interface AnonymousButtonProps {
  /** 保留以与其它登录按钮签名对齐（匿名登录后停留在当前页）。 */
  callbackURL?: string;
}

export function AnonymousButton(_props: AnonymousButtonProps) {
  const [submitting, setSubmitting] = useState(false);

  const handleSignIn = async () => {
    setSubmitting(true);
    try {
      const result = await authClient.signIn.anonymous();
      if (result?.error) {
        toast.error(result.error.message ?? m["common.sign.guest_failed"]());
        return;
      }
      toast.success(m["common.sign.guest_success"]());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Button className="w-full" disabled={submitting} onClick={handleSignIn} type="button" variant="outline">
      <Ghost aria-hidden="true" className="size-4" />
      {submitting ? m["common.sign.guest_creating"]() : m["common.sign.guest_title"]()}
    </Button>
  );
}
