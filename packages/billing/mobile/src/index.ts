// @openstarter/billing-mobile 包入口 —— 移动端支付能力统一出口。
//
// 聚合 RevenueCat 两套底层库并以命名空间 re-export；业务侧（apps/mobile）
// 只 import 本包，不直接依赖底层库：
//   - Purchases: RevenueCat SDK 主类（default 导出，命名转出）
//     —— configure/logIn/logOut/restorePurchases 等
//   - RevenueCatUI: Paywalls 付费墙组件（默认导出类的静态成员 Paywall）
//
// 注意：RevenueCat 是唯一的 IAP 观察者。曾并行引入的 expo-iap 已移除 ——
// 两套 IAP 库都会观察原生支付队列，同一商品流只能走其中一套。
export { default as Purchases } from "react-native-purchases";
export { default as RevenueCatUI } from "react-native-purchases-ui";
