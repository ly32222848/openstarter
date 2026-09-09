// billing 屏：plan 徽章 + 订阅三格（状态/方案/下一计费日）+ 升级入口 + 管理订阅。
//
// 401 = 未登录（清会话交门禁）；unreachable/server-error = 错误 + 重试按钮。
// 升级入口的分流（App Store 审核 3.1.1：iOS 不得引导外跳购买）：
//   - IAP 可用（config 开关 + RC SDK key + configure 成功）→ push 内置 paywall；
//   - iOS 且 IAP 不可用 → 不渲染任何购买入口（只在已订阅时给管理订阅）；
//   - Android 且 IAP 不可用 → Linking.openURL(`${apiUrl}/pricing`) 网页兜底。
import { Button, Card, CardContent, CardTitle, Text } from "@openstarter/ui-mobile";
import { useTranslation } from "@openstarter/i18n-mobile";
import { useEffect, useState } from "react";
import { Platform, View } from "react-native";

import { Screen } from "@/components/ui/screen";
import { Spinner } from "@/components/ui/spinner";
import { useRouter } from "expo-router";
import { authClient } from "@/lib/auth-client";
import { BUILD_FLAGS, getBuildTimeFlag, getEnv } from "@/lib/env";
import {
  useBillingPortalMutation,
  usePublicConfig,
  useUserPlan,
  useUserSubscription,
} from "@/lib/queries";
import { resolveIapEnabled } from "@/lib/public-config";
import { isPurchasesAvailable } from "@/lib/purchases";
import { formatIsoDate } from "@/lib/billing-format";

/** 计费状态 → 展示标签。pending_cancel 视作会员（权益未到期），无订阅看 trialEndsAt。 */
function resolvePlanBadge(
  plan: string,
  subscription: { hasSubscription: boolean; status: string | null } | undefined,
  trialEndsAt: string | null,
): { key: string } | null {
  if (subscription?.hasSubscription) {
    if (subscription.status === "trialing") {
      return { key: "settings.billing.plan_trial" };
    }
    return { key: "settings.billing.plan_member" };
  }
  if (plan !== "none") {
    return { key: "settings.billing.plan_member" };
  }
  if (trialEndsAt) {
    return { key: "settings.billing.plan_trial" };
  }
  return { key: "settings.billing.plan_none" };
}

/** 订阅三格中的一格。 */
function InfoRow(props: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text className="text-muted-foreground text-sm dark:text-dark-muted-foreground">
        {props.label}
      </Text>
      <Text className="text-foreground text-sm dark:text-dark-foreground">{props.value}</Text>
    </View>
  );
}

export default function BillingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const configQuery = usePublicConfig();
  const planQuery = useUserPlan();
  const subscriptionQuery = useUserSubscription();
  const portalMutation = useBillingPortalMutation();
  const [portalError, setPortalError] = useState<string | null>(null);

  // IAP 可用 = 构建期开关 + 服务端公开开关 + RC SDK key + configure 成功，
  // 四者缺一即视为不可用（构建期开关随渠道固化，服务端开关保留远程 kill-switch）。
  const iapAvailable =
    getBuildTimeFlag(BUILD_FLAGS.iapEnabled) &&
    resolveIapEnabled(configQuery.data ?? {}) &&
    isPurchasesAvailable();
  // 升级入口可见性：IAP 可用 → 内置 paywall；否则仅 Android 兜底网页定价页。
  const showUpgradeEntry = iapAvailable || Platform.OS !== "ios";

  // 401 = 未登录而不是错误：清掉会话，门禁随即送回登录页。
  useEffect(() => {
    const unauthorized =
      planQuery.data?.status === "unauthorized" ||
      subscriptionQuery.data?.status === "unauthorized";
    if (unauthorized) {
      authClient.signOut().catch(() => undefined);
    }
  }, [planQuery.data?.status, subscriptionQuery.data?.status]);

  if (planQuery.isPending || subscriptionQuery.isPending) {
    return <Spinner />;
  }

  const planResult = planQuery.data;
  const subscriptionResult = subscriptionQuery.data;
  const loading = !planResult || !subscriptionResult;

  if (loading) {
    return <Spinner />;
  }

  const failed = planResult.status !== "success" || subscriptionResult.status !== "success";
  const failureMessage =
    planResult.status === "unreachable" || subscriptionResult.status === "unreachable"
      ? t("common.error.unreachable")
      : planResult.status === "server-error"
        ? planResult.message
        : subscriptionResult.status === "server-error"
          ? subscriptionResult.message
          : null;

  const badge = failed
    ? null
    : resolvePlanBadge(
        planResult.status === "success" ? planResult.data.plan : "none",
        subscriptionResult.status === "success" ? subscriptionResult.data : undefined,
        planResult.status === "success" ? planResult.data.trialEndsAt : null,
      );

  const subscription = subscriptionResult.status === "success" ? subscriptionResult.data : null;

  const nextBillingDate = formatIsoDate(subscription?.nextBillingDate ?? null);
  const renewing = subscription?.status === "active" || subscription?.status === "trialing";

  const openPortal = () => {
    setPortalError(null);
    portalMutation.mutateAsync().then((result) => {
      if (result.status === "success" && result.data.billingUrl) {
        // Linking 在 tsc 裸环境也可用；这里用动态引入保持组件树纯净。
        void import("react-native").then(({ Linking }) => {
          Linking.openURL(result.data.billingUrl).catch(() => {
            setPortalError(t("common.error.message"));
          });
        });
      } else if (result.status !== "unauthorized") {
        setPortalError(
          result.status === "server-error" ? result.message : t("common.error.message"),
        );
      }
    });
  };

  return (
    <Screen>
      <View className="gap-4 p-6">
        <Card className="gap-3 p-4">
          <CardTitle>{t("settings.billing.title")}</CardTitle>
          <CardContent className="flex flex-col gap-3 p-0">
            {failed ? (
              <View className="gap-3">
                {failureMessage ? (
                  <Text className="text-destructive text-sm dark:text-dark-destructive">
                    {failureMessage}
                  </Text>
                ) : null}
                <Button
                  onPress={() => {
                    planQuery.refetch().catch(() => undefined);
                    subscriptionQuery.refetch().catch(() => undefined);
                  }}
                  variant="outline"
                >
                  <Text>{t("common.error.retry")}</Text>
                </Button>
              </View>
            ) : (
              <>
                {badge ? (
                  <View className="self-start">
                    <Text className="text-foreground font-semibold text-lg dark:text-dark-foreground">
                      {t(badge.key)}
                    </Text>
                  </View>
                ) : null}
                <View>
                  <InfoRow
                    label={t("settings.billing.status")}
                    value={subscription?.status ?? t("settings.billing.no_subscription")}
                  />
                  <InfoRow
                    label={t("settings.billing.plan")}
                    value={subscription?.planName ?? t("settings.billing.no_subscription")}
                  />
                  <InfoRow
                    label={
                      renewing ? t("settings.billing.end_time") : t("settings.billing.period_end")
                    }
                    value={nextBillingDate ?? "-"}
                  />
                </View>
                <View className="gap-2">
                  {showUpgradeEntry ? (
                    <Button
                      onPress={() => {
                        if (iapAvailable) {
                          // 内置付费墙（RevenueCat 托管 UI + StoreKit 结算）。
                          router.push("/settings/paywall");
                          return;
                        }
                        // Android 网页兜底：跳站外定价页（web 端自有支付）。
                        void import("react-native").then(({ Linking }) => {
                          const env = getEnv();
                          if (env.ok) {
                            Linking.openURL(`${env.apiUrl}/pricing`).catch(() => undefined);
                          }
                        });
                      }}
                      variant="outline"
                    >
                      <Text>{t("settings.billing.upgrade")}</Text>
                    </Button>
                  ) : null}
                  {subscription?.hasSubscription && !iapAvailable ? (
                    <Button onPress={openPortal} variant="ghost">
                      <Text>{t("settings.billing.manage_portal")}</Text>
                    </Button>
                  ) : null}
                  {subscription?.hasSubscription && iapAvailable ? (
                    <Button
                      onPress={() => {
                        // 恢复购买走 RC SDK（门面静默处理失败，返回 false 不打断）。
                        void import("@/lib/purchases").then(({ restorePurchases }) => {
                          void restorePurchases();
                        });
                      }}
                      variant="ghost"
                    >
                      <Text>{t("settings.billing.restore")}</Text>
                    </Button>
                  ) : null}
                  {portalError ? (
                    <Text className="text-destructive text-sm dark:text-dark-destructive">
                      {portalError}
                    </Text>
                  ) : null}
                </View>
              </>
            )}
          </CardContent>
        </Card>
      </View>
    </Screen>
  );
}
