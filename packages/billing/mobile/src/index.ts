// @openstarter/billing-mobile 包入口 —— 移动端支付能力统一出口。
//
// 聚合三套底层库并以命名空间 re-export，避免 RevenueCat 与 expo-iap 之间
// 同名类型/函数冲突；业务侧（apps/mobile）只 import 本包，不直接依赖底层库：
//   - purchases: RevenueCat SDK —— 订阅管理、跨平台收据验证（Purchases.configure 初始化）
//   - paywall:   RevenueCat Paywalls —— 付费墙 UI 组件（Paywall / PaywallView）
//   - iap:       expo-iap —— OpenIAP 规范的应用内购买（StoreKit 2 / Play Billing 8.x）
//
// 注意：两套 IAP 库都会观察原生支付队列，同一商品流只能走其中一套。
export * as purchases from "react-native-purchases";
export * as paywall from "react-native-purchases-ui";
export * as iap from "expo-iap";
