// apps/mobile/src/lib/purchases.ts —— RevenueCat 门面（app 侧薄壳）。
//
// 模式对齐 lib/analytics.ts：幂等初始化、能力不可用时全 no-op、永不向业务抛错。
// 真正的 SDK 在 @openstarter/billing-mobile（react-native-purchases / -ui）。
//
// 判定「不可用」的三个条件（任一满足即 no-op）：
//   1. RC SDK key 缺失（EXPO_PUBLIC_REVENUECAT_IOS_API_KEY 未配置）；
//   2. 非原生运行（Expo Go / web —— react-native-purchases 没有原生模块）;
//   3. configure 已完成（幂等保护，重复调用直接返回）。
//
// identify/reset 与登录态绑定：better-auth userId 即 RC app_user_id，
// 服务端 webhook 拿 app_user_id 归属订单，零映射。
import { Purchases } from "@openstarter/billing-mobile";

import { getRevenueCatApiKey } from "./env";

/**
 * 初始化共享 Promise：并发调用共享同一次 configure（幂等），
 * 且 identify 等后续调用 await 它 —— 消除"identify 先于 configure 完成"的竞态。
 * resolve 值 = IAP 是否可用。async 函数体无 await，configure 与 available
 * 标志在 initPurchases() 调用的同一个 tick 内同步完成。
 */
let initPromise: Promise<boolean> | null = null;
let available = false;

/** 是否具备运行 IAP 的前提（原生环境 + key 已配置 + configure 成功）。 */
export function isPurchasesAvailable(): boolean {
  return available;
}

/** 初始化（幂等）：key 缺失 / 非原生环境时降级为不可用（resolve false）。 */
export function initPurchases(): Promise<boolean> {
  if (!initPromise) {
    initPromise = (async () => {
      const apiKey = getRevenueCatApiKey();
      if (!apiKey) {
        return false;
      }
      try {
        Purchases.configure({ apiKey });
        available = true;
        return true;
      } catch {
        // configure 失败（如 Expo Go 下无原生模块）：IAP 整体降级为不可用。
        available = false;
        return false;
      }
    })();
  }
  return initPromise;
}

/** 登录后调用：把 better-auth userId 绑定为 RC app_user_id。 */
export async function identify(userId: string): Promise<void> {
  if (!userId || !(await initPurchases())) {
    return;
  }
  try {
    await Purchases.logIn(userId);
  } catch {
    // logIn 失败不影响主流程；下次登录或 customerInfo 更新会再同步。
  }
}

/** 登出时调用：解除 RC 用户关联（匿名 id 回收）。 */
export async function resetPurchases(): Promise<void> {
  if (!(await initPurchases())) {
    return;
  }
  try {
    await Purchases.logOut();
  } catch {
    // 同上，静默。
  }
}

/** 恢复购买：返回是否恢复了有效订阅；失败返回 false（由 UI 呈现）。 */
export async function restorePurchases(): Promise<boolean> {
  if (!(await initPurchases())) {
    return false;
  }
  try {
    // SDK 直接返回 CustomerInfo（不是 { customerInfo } 包裹）。
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo.activeSubscriptions.length > 0;
  } catch {
    return false;
  }
}

/** 注册 customerInfo 更新监听（购买/续费/到期推送）；返回取消函数。 */
export function addCustomerInfoUpdateListener(
  listener: () => void,
): () => void {
  if (!available) {
    return () => undefined;
  }
  // SDK 是"注册引用 + removeListener"模型：add 返回 void，
  // 取消时把同一个函数引用传给 removeCustomerInfoUpdateListener。
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    try {
      Purchases.removeCustomerInfoUpdateListener(listener);
    } catch {
      // 未初始化/原生端已销毁时移除失败可忽略。
    }
  };
}
