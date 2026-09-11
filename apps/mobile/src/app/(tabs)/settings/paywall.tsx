// paywall 屏：策略层托管付费墙（imperative present）+ 服务端确认轮询。
//
// 进屏即 present({ trigger })（供应商由构建期 env 决定，当前=revenuecat 托管
// 付费墙）。购买/恢复成功后：customerInfo 监听（use-billing）会失效账单缓存，
// 这里再做有界轮询（runPurchaseConfirmation）等 webhook 落地 —— webhook 是
// 唯一事实来源，轮询只是 5-60s 窗口内的展示收敛，超时走 purchase_processing
// 兜底文案，绝不谎报成功。present 失败（onError）→ 退回 billing 屏。
import { usePaywall } from "@openstarter/billing-mobile";
import { useTranslation } from "@openstarter/i18n-mobile";
import { Button, Text } from "@openstarter/ui-mobile";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";

import { Screen } from "@/components/ui/screen";
import { useUserPlan, useUserCredits } from "@/lib/queries";
import { runPurchaseConfirmation } from "@/lib/purchase-confirmation";

export default function PaywallScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const planQuery = useUserPlan();
  const creditsQuery = useUserCredits();
  const [confirming, setConfirming] = useState(false);
  const [pendingNotice, setPendingNotice] = useState(false);
  const settled = useRef(false);
  const presented = useRef(false);

  /** 服务端是否已反映购买（plan 升级或余额增加均为成功信号）。 */
  const pollServerConfirmation = async (): Promise<boolean> => {
    const [plan, credits] = await Promise.all([
      planQuery
        .refetch()
        .then((q) => q.data)
        .catch(() => null),
      creditsQuery
        .refetch()
        .then((q) => q.data)
        .catch(() => null),
    ]);
    // ApiResult 判别联合：status === "success" 时 data 才有值。
    const planUpgraded = plan?.status === "success" && plan.data.plan !== "none";
    const creditsGranted = credits?.status === "success" && credits.data.balance > 0;
    return planUpgraded || creditsGranted;
  };

  /** 购买/恢复成功的统一后处理：有界轮询 + 关闭付费墙（幂等）。 */
  const handlePurchaseSettled = (): void => {
    if (settled.current) {
      return;
    }
    settled.current = true;
    setConfirming(true);
    void runPurchaseConfirmation({ poll: pollServerConfirmation }).then((result) => {
      setConfirming(false);
      if (result.status === "timeout") {
        // webhook 未落地：提示处理中，仍关闭付费墙（billing 屏会随后反映）。
        setPendingNotice(true);
      }
      router.replace("/settings/billing");
    });
  };

  const { present } = usePaywall({
    onPurchase: () => handlePurchaseSettled(),
    onRestore: () => handlePurchaseSettled(),
    onError: () => {
      // 弹墙失败（如未 configure）：退回 billing 屏，由其可用性门禁分流。
      if (!settled.current) {
        router.replace("/settings/billing");
      }
    },
    onDismiss: () => {
      // 用户主动关闭付费墙（未购买/未恢复）：退回 billing 屏，避免空白死屏。
      if (!settled.current) {
        router.replace("/settings/billing");
      }
    },
    onSkip: () => {
      // 付费墙未弹出（如不可用/命中 holdout）：同 onError 退回。
      if (!settled.current) {
        router.replace("/settings/billing");
      }
    },
  });

  // 进屏即弹墙一次（present 引用每渲染变化，用 ref 防重复触发）。
  useEffect(() => {
    if (presented.current) {
      return;
    }
    presented.current = true;
    void present({ trigger: "billing" });
  }, [present]);

  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-4 p-6">
        {confirming || pendingNotice ? (
          <Text className="text-muted-foreground text-center text-sm dark:text-dark-muted-foreground">
            {t("settings.billing.purchase_processing")}
          </Text>
        ) : null}
        {pendingNotice && !confirming ? (
          <Button onPress={() => router.replace("/settings/billing")} variant="outline">
            <Text>{t("settings.billing.close")}</Text>
          </Button>
        ) : null}
      </View>
    </Screen>
  );
}
