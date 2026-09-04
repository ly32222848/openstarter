// apps/extension/src/components/error-state.tsx —— 网络/服务端错误态（不含 401）。
// Retry 按钮文案经 #i18n 取译文；错误 message 本身（来自 HTTP 层）保持原样。
import { i18n } from "#i18n";

import { Button } from "@openstarter/ui-web/components/button";

export function ErrorState(props: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 p-6 text-center">
      <p className="text-destructive text-sm">{props.message}</p>
      <Button onClick={props.onRetry} type="button" variant="outline">
        {i18n.t("error.retry")}
      </Button>
    </div>
  );
}
