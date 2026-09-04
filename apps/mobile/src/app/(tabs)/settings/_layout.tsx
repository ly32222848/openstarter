// settings 目录化后的内嵌 Stack：index 是原设置页（隐藏 header 以复用 Screen 全屏布局），
// billing / credits / orders 子页显示 header 并以 i18n 标题命名，paywall（Phase B）自绘关闭。
import { Stack } from "expo-router";
import { useTranslation } from "@openstarter/i18n-mobile";

export default function SettingsLayout() {
  const { t } = useTranslation();

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="billing"
        options={{ headerShown: true, title: t("settings.billing.title") }}
      />
      <Stack.Screen
        name="credits"
        options={{ headerShown: true, title: t("settings.credits.title") }}
      />
      <Stack.Screen
        name="orders"
        options={{ headerShown: true, title: t("settings.payments.title") }}
      />
    </Stack>
  );
}
