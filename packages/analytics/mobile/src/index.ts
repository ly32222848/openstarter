// @openstarter/analytics-mobile —— 移动端分析统一出口。
//
// 消费方（apps/mobile）只 import 本包：
//   import { initAnalytics, track, ... } from "@openstarter/analytics-mobile";
// 不直接依赖 @openpanel/react-native 或 @react-native-firebase/*。
export type {
  AnalyticsProvider,
  EventProperties,
  UserTraits,
} from "./providers/types";
export { createNoopProvider } from "./providers/noop";
