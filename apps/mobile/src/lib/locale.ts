// apps/mobile/src/lib/locale.ts —— 决定启动时用哪个语言。
//
// Web 端走 URL / cookie 策略，两者都是浏览器专属；原生端没有这些概念，
// 由应用自己解析初始语言并交给 i18next（lng 选项 + changeLanguage）。
//
// 优先级：用户显式选择（持久化） > 设备语言 > DEFAULT_LOCALE。
// 设备语言按主语言子标签匹配：zh-Hans-CN / ZH-CN 都应命中 "zh"。
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from "@openstarter/i18n-mobile";

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  if (!value) {
    return false;
  }
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function resolveInitialLocale(
  deviceLocales: readonly string[],
  persisted: string | null,
): SupportedLocale {
  if (isSupportedLocale(persisted)) {
    return persisted;
  }

  for (const tag of deviceLocales) {
    const primary = tag.split("-")[0]?.toLowerCase();
    if (isSupportedLocale(primary)) {
      return primary;
    }
  }

  return DEFAULT_LOCALE;
}
