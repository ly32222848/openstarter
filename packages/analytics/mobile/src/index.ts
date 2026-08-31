// @openstarter/analytics-mobile —— 移动端分析统一出口。
//
// 消费方（apps/mobile）只 import 本包：
//   import { initAnalytics, track, ... } from "@openstarter/analytics-mobile";
// 不直接依赖 @openpanel/react-native 或 @react-native-firebase/*。
export { resolveMobileAnalyticsConfig } from "./config";
export type { MobileAnalyticsConfig } from "./config";
export {
  identify,
  initAnalytics,
  resetAnalyticsForTests,
  setScreenName,
  setUserId,
  track,
} from "./facade";
export { createNoopProvider } from "./providers/noop";
export { sanitizeGaEventName } from "./providers/firebase";
export { createOpenPanelProvider } from "./providers/openpanel";
export { createFirebaseProvider } from "./providers/firebase";
export type { AnalyticsProvider, EventProperties, UserTraits } from "./providers/types";
