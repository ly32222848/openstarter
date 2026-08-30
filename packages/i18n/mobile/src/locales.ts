// 受支持语言常量（en/zh）。消息文件（messages/{locale}.json）与
// resources 导出的语言键保持一致。

// 受支持的界面语言集合。
export const SUPPORTED_LOCALES = ["en", "zh"] as const;

// 受支持 locale 的字面量联合类型。
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

// 基准/兜底默认语言（i18next 的 fallbackLng）。移动端初始语言由
// expo-localization 的系统语言与本地用户偏好共同决定（见 apps/mobile/src/lib/locale.ts），
// 此常量为无任何匹配时的最终回落值。
export const DEFAULT_LOCALE: SupportedLocale = "en";

// 翻译键类型：en/zh 消息文件覆盖相同键集合（键为带命名空间前缀的扁平字符串，
// i18next 以 keySeparator: false 消费）。此处以 string 承载，
// 供调用方按字符串键消费，不与具体消息键联合类型强耦合。
export type TranslationKey = string;
