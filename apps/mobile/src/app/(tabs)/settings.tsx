import type { SupportedLocale } from "@openstarter/i18n-mobile";
import { SUPPORTED_LOCALES, useTranslation } from "@openstarter/i18n-mobile";
import { Button, Card, CardContent, CardTitle, Text } from "@openstarter/ui-mobile";
import Constants from "expo-constants";
import { View } from "react-native";

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
        <Card className="gap-3 p-4">
          <CardTitle>{t("mobile.settings.appearance")}</CardTitle>
          <CardContent className="flex flex-col gap-2 p-0">
            {THEME_OPTIONS.map((option) => (
              <Button
                key={option}
                onPress={() => setPreference(option)}
                variant={option === preference ? "default" : "outline"}
              >
                <Text>{t(THEME_LABEL_KEYS[option])}</Text>
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card className="gap-3 p-4">
          <CardTitle>{t("common.nav.language")}</CardTitle>
          <CardContent className="flex flex-col gap-2 p-0">
            {SUPPORTED_LOCALES.map((option) => (
              <Button
                key={option}
                onPress={() => setAppLocale(option)}
                variant={option === locale ? "default" : "outline"}
              >
                <Text>{LOCALE_LABELS[option]}</Text>
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card className="p-4">
          <CardContent className="flex-row items-center justify-between p-0">
            <Text className="text-muted-foreground text-xs dark:text-dark-muted-foreground">
              {t("mobile.settings.version")}
            </Text>
            <Text className="text-foreground text-sm dark:text-dark-foreground">
              {Constants.expoConfig?.version ?? "-"}
            </Text>
          </CardContent>
        </Card>

        <Button
          onPress={() => {
            authClient.signOut().catch(() => undefined);
          }}
          variant="outline"
        >
          <Text>{t("common.sign.sign_out_title")}</Text>
        </Button>
      </View>
    </Screen>
  );
}
