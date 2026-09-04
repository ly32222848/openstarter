// @openstarter/i18n-extension 包入口 —— 插件端消息目录、语言集合与运行时工具。
// browser.i18n 运行时本体（#i18n 的 i18n.t）由 apps/extension 构建期的 @wxt-dev/i18n
// 模块生成；本包持有目录（locales/*.json，被 wxt.config.ts 直接指向）与 TS 消费形态。
export {
  EXTENSION_DEFAULT_LOCALE,
  EXTENSION_LOCALES,
  EXTENSION_MESSAGES,
  flattenCatalog,
  translateMessage,
} from "./messages";
export type { ExtensionLocale } from "./messages";
