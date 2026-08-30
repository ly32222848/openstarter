import type { SupportedLocale } from "@openstarter/i18n-mobile";
import { SUPPORTED_LOCALES } from "@openstarter/i18n-mobile";
import Constants from "expo-constants";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { authClient } from "@/lib/auth-client";
import { useAppLocale } from "@/lib/i18n";
import type { ThemePreference } from "@/lib/preferences";
import { useThemePreference } from "@/lib/theme";

const THEME_OPTIONS: readonly ThemePreference[] = ["light", "dark", "system"];

const THEME_LABEL_KEYS: Record<ThemePreference, string> = {
  dark: "common.nav.theme_dark",
  light: "common.nav.theme_light",
  system: "common.nav.theme_system",
};

const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: "English",
  zh: "中文",
};

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { preference, setPreference } = useThemePreference();
  const { locale, setAppLocale } = useAppLocale();

  return (
    <Screen>
      <View className="gap-4 p-6">
        <Card title={t("mobile.settings.appearance")}>
          <View className="gap-2">
            {THEME_OPTIONS.map((option) => (
              <Button
                key={option}
                label={t(THEME_LABEL_KEYS[option])}
                onPress={() => setPreference(option)}
                variant={option === preference ? "primary" : "outline"}
              />
            ))}
          </View>
        </Card>

        <Card title={t("common.nav.language")}>
          <View className="gap-2">
            {SUPPORTED_LOCALES.map((option) => (
              <Button
                key={option}
                label={LOCALE_LABELS[option]}
                onPress={() => setAppLocale(option)}
                variant={option === locale ? "primary" : "outline"}
              />
            ))}
          </View>
        </Card>

        <Card>
          <View className="flex-row items-center justify-between">
            <Text className="text-muted-foreground text-xs dark:text-dark-muted-foreground">
              {t("mobile.settings.version")}
            </Text>
            <Text className="text-foreground text-sm dark:text-dark-foreground">
              {Constants.expoConfig?.version ?? "-"}
            </Text>
          </View>
        </Card>

        <Button
          label={t("common.sign.sign_out_title")}
          onPress={() => {
            authClient.signOut().catch(() => undefined);
          }}
          variant="outline"
        />
      </View>
    </Screen>
  );
}
