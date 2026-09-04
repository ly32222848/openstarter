// @openstarter/analytics-mobile —— 移动端分析统一出口。
//
// 消费方（apps/mobile）只 import 本包：
//   import { initAnalytics, track, ... } from "@openstarter/analytics-mobile";
// 不直接依赖 @openpanel/react-native 或 @react-native-firebase/*。
//
// 出口刻意只含 facade + config 两层：provider 工厂与测试辅助
// （createNoopProvider / sanitizeGaEventName / resetAnalyticsForTests 等）
// 不进公共 API，需要时走 ./* 深路径导出（如 "@openstarter/analytics-mobile/facade"）。
export { resolveMobileAnalyticsConfig } from "./config";
export type { MobileAnalyticsConfig } from "./config";
export { identify, initAnalytics, setScreenName, setUserId, track } from "./facade";
export type { AnalyticsProvider, EventProperties, UserTraits } from "./providers/types";
