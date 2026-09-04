// paywall 屏（Task B4）：RevenueCatUI.Paywall 全屏承载 + 自绘关闭。
//
// 只在 IAP 可用时被 push 到（billing 屏 gate：resolveIapEnabled(config) &&
// RC SDK key 存在 && Purchases.configure 成功）；直接以深链进入本屏时若
// 不可用则退回 billing。
//
// 购买/恢复成功后：customerInfo 监听（use-revenuecat）会失效账单缓存，
// 这里再做有界轮询（runPurchaseConfirmation）等 webhook 落地 —— webhook
// 是唯一事实来源，轮询只是 5-60s 窗口内的展示收敛，超时走 purchase_processing
// 兜底文案，绝不谎报成功。
import { RevenueCatUI } from "@openstarter/billing-mobile";
import { useTranslation } from "@openstarter/i18n-mobile";
import { Button, Text } from "@openstarter/ui-mobile";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { Screen } from "@/components/ui/screen";
import { useUserPlan, useUserCredits } from "@/lib/queries";
import { runPurchaseConfirmation } from "@/lib/purchase-confirmation";
import { isPurchasesAvailable } from "@/lib/purchases";

/** MIN 触控热区（与 settings/index.tsx 的 EntryRow 同标准）。 */
const MIN_TOUCH_TARGET = 44;

export default function PaywallScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const planQuery = useUserPlan();
  const creditsQuery = useUserCredits();
  const [confirming, setConfirming] = useState(false);
  const [pendingNotice, setPendingNotice] = useState(false);

  // 深链直入而 IAP 不可用：退回上一屏（billing 的入口本身就带 gate）。
  if (!isPurchasesAvailable()) {
    router.replace("/settings/billing");
    return null;
  }

  /** 服务端是否已反映购买（plan 升级或余额增加均为成功信号）。 */
  const pollServerConfirmation = async (): Promise<boolean> => {
    const [plan, credits] = await Promise.all([
      planQuery.refetch().then((q) => q.data).catch(() => null),
      creditsQuery.refetch().then((q) => q.data).catch(() => null),
    ]);
    const planUpgraded =
      plan?.status === "success" && plan.data.plan !== "none";
    const creditsGranted =
      credits?.status === "success" && credits.data.balance > 0;
    return planUpgraded || creditsGranted;
  };

  /** 购买/恢复成功的统一后处理：有界轮询 + 关闭付费墙。 */
  const handlePurchaseSettled = (): void => {
    setConfirming(true);
    void runPurchaseConfirmation({ poll: pollServerConfirmation }).then(
      (result) => {
        setConfirming(false);
        if (result.status === "timeout") {
          // webhook 未落地：提示处理中，仍关闭付费墙（billing 屏会随后反映）。
          setPendingNotice(true);
        }
        router.replace("/settings/billing");
      },
    );
  };

  return (
    <Screen>
      <View className="flex-1">
        <View className="flex-row justify-end p-2">
          <Pressable
            accessibilityLabel={t("settings.billing.close")}
            accessibilityRole="button"
            disabled={confirming}
            onPress={() => router.back()}
            style={{
              minHeight: MIN_TOUCH_TARGET,
              minWidth: MIN_TOUCH_TARGET,
            }}
            className="items-center justify-center active:opacity-60"
          >
            <Text className="text-muted-foreground text-xl dark:text-dark-muted-foreground">
              ✕
            </Text>
          </Pressable>
        </View>
        <View className="flex-1">
          <RevenueCatUI.Paywall
            onPurchaseCompleted={() => handlePurchaseSettled()}
            onRestoreCompleted={() => handlePurchaseSettled()}
          />
        </View>
        {confirming || pendingNotice ? (
          <View className="p-4">
            <Text className="text-muted-foreground text-center text-sm dark:text-dark-muted-foreground">
              {t("settings.billing.purchase_processing")}
            </Text>
          </View>
        ) : null}
        {pendingNotice && !confirming ? (
          <View className="p-4 pt-0">
            <Button
              onPress={() => router.replace("/settings/billing")}
              variant="outline"
            >
              <Text>{t("settings.billing.close")}</Text>
            </Button>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
