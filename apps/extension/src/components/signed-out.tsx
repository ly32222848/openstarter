// apps/extension/src/components/signed-out.tsx —— 未登录态：引导去 web 端登录。
// 插件内不放登录表单（见 spec §2 登录体验决策）。
// 文案经 #i18n（@wxt-dev/i18n，跟随浏览器 UI 语言）取译文。
import { i18n } from "#i18n";

import { Button } from "@openstarter/ui-web/components/button";

export function SignedOut(props: { onSignIn: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 p-6 text-center">
      <p className="text-muted-foreground text-sm">{i18n.t("auth.sign_in_prompt")}</p>
      <Button onClick={props.onSignIn} type="button">
        {i18n.t("auth.sign_in")}
      </Button>
    </div>
  );
}
