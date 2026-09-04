// Vitest 专用 #i18n stub —— 与 @wxt-dev/i18n 生成的 #i18n 同面（{ i18n: { t } }）。
// 真实实现同步调 browser.i18n.getMessage（jsdom 无此 API），这里从
// @openstarter/i18n-extension 的目录直接取默认语言（en）译文并做 {name} 替换，
// 使组件测试继续断言真实英文文案、零 mocking。经 vitest.config.ts 的 alias 注入。
import { EXTENSION_DEFAULT_LOCALE, translateMessage } from "@openstarter/i18n-extension";

export const i18n = {
  t: (key: string, ...args: unknown[]): string => {
    const named = args.find(
      (arg): arg is Record<string, string | number> =>
        typeof arg === "object" && arg !== null && !Array.isArray(arg),
    );
    return translateMessage(EXTENSION_DEFAULT_LOCALE, key, named);
  },
};
