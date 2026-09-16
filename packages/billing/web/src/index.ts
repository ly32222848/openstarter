// @openstarter/billing-web 包入口。
// 汇总各域（payment/subscriptions/credits/referral）。payment（任务 16）与 subscriptions
// （任务 17）已落位，经各自 barrel 聚合 re-export；Webhook 成功编排（任务 18）待实现。
// Ruling B：referral 域宽带导出，包含佣金数学 + 记账服务，供 packages/api 直接 import。
export * from "./credits";
export * from "./payment";
export * from "./referral";
export * from "./subscriptions";
