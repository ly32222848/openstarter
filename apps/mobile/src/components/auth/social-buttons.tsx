import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import type { MobileSocialProvider } from "@/lib/public-config";

const LABEL_KEYS: Record<MobileSocialProvider, string> = {
  apple: "common.sign.apple_sign_in",
  google: "common.sign.google_sign_in",
};

export function SocialButtons(props: {
  providers: MobileSocialProvider[];
  onError: (message: string) => void;
}) {
  const { t } = useTranslation();

  const handlePress = (provider: MobileSocialProvider) => {
    // callbackURL 是应用内路径；Expo 插件据 scheme 组装成深链，
    // 授权完成后浏览器回跳到 openstarter:// 并由 expo-router 落到这里。
    authClient.signIn.social({ callbackURL: "/", provider }).catch((error: unknown) => {
      props.onError(error instanceof Error ? error.message : "OAuth sign-in failed");
    });
  };

  return (
    <View className="gap-2">
      {props.providers.map((provider) => (
        <Button
          key={provider}
          label={t(LABEL_KEYS[provider])}
          onPress={() => handlePress(provider)}
          variant="outline"
        />
      ))}
    </View>
  );
}
