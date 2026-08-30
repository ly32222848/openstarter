// @openstarter/i18n-mobile —— 移动端专用的 i18next 翻译资源与运行时。
// 与 packages/i18n/web（Web/扩展端，inlang/Paraglide）相互独立：
// 移动端采用 i18next + react-i18next，本包统一持有 i18next 技术栈（依赖声明、
// 运行时初始化、resources 与 locale 常量），消息文件（messages/{locale}.json）
// 可按端各自演化。位于 auth 依赖层之下，不依赖 packages/api、packages/auth。
//
// 业务侧（apps/mobile）不直接依赖 i18next/react-i18next：
//   - 初始化：initI18next({ initialLocale })
//   - 组件内取译文：useTranslation()（react-i18next re-export）
//   - 命令式操作（changeLanguage 等）：i18next 实例

// 受支持语言集合与类型。
export * from "./locales";

// i18next 运行时：初始化入口与实例。
export { i18next, initI18next } from "./runtime";

// react-i18next 全量 re-export：useTranslation / Trans / initReactI18next 等，
// 保证组件与本包内 i18next 实例消费同一份模块。
export * from "react-i18next";
