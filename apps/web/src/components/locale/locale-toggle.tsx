import { Button } from "@openstarter/ui-web/components/button";
import { Languages } from "lucide-react";
import { useEffect, useState } from "react";

import { getLocale, setLocale } from "@/paraglide/runtime.js";

/**
 * 语言切换按钮：中文 ⇄ English。
 * setLocale() 会写入 PARAGLIDE_LOCALE cookie 并跳转到对应 URL 前缀
 * （/zh/... 或 /...），服务端 SSR 同样读取该 cookie，刷新后保持语言。
 */
export function LocaleToggle() {
  const [mounted, setMounted] = useState(false);
  const [locale, setLocaleState] = useState<string>("en");

  useEffect(() => {
    setMounted(true);
    try {
      setLocaleState(getLocale());
    } catch {
      setLocaleState("en");
    }
  }, []);

  const next = locale === "zh" ? "en" : "zh";

  return (
    <Button
      aria-label={locale === "zh" ? "Switch to English" : "切换为中文"}
      onClick={() => setLocale(next)}
      size="sm"
      type="button"
      variant="ghost"
    >
      <Languages aria-hidden="true" className="size-4" />
      <span className="text-xs font-medium">
        {mounted ? (locale === "zh" ? "EN" : "中") : "EN"}
      </span>
    </Button>
  );
}
