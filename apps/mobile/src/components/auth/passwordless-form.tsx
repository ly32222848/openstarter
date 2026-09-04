// 无密码登录表单（Magic Link / Email OTP）：依据 Config 启用集合渲染对应 UI。
// 与 apps/web/src/components/auth/passwordless-form.tsx 同构，差异只有平台层：
// toast → 内联文案，Input/Label → Field，onClick → onPress。
//
// - Magic Link：输入邮箱后下发一次性登录链接到邮箱；expo client 会把 callbackURL
//   经 Linking.createURL 改写为 openstarter:// 深链，cookie exchange 复用 OAuth 管道。
// - Email OTP：输入邮箱后下发一次性验证码，第二段输入验证码完成登录。
//
// 两个开关都关时组件不渲染（由 sign-in.tsx 控制）。

import { useTranslation } from "@openstarter/i18n-mobile";
import { Button, Field, Text } from "@openstarter/ui-mobile";
import { useState } from "react";
import { View } from "react-native";

import { authClient } from "@/lib/auth-client";
import type { PasswordlessMode } from "@/lib/public-config";

interface PasswordlessFormProps {
  emailOtpEnabled: boolean;
  magicLinkEnabled: boolean;
}

export function PasswordlessForm({ magicLinkEnabled, emailOtpEnabled }: PasswordlessFormProps) {
  const { t } = useTranslation();
  const modes: PasswordlessMode[] = [];
  if (magicLinkEnabled) {
    modes.push("magic-link");
  }
  if (emailOtpEnabled) {
    modes.push("email-otp");
  }

  const [mode, setMode] = useState<PasswordlessMode | null>(modes[0] ?? null);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpInputMode, setOtpInputMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (modes.length === 0 || mode === null) {
    return null;
  }

  const handleMagicLink = async () => {
    setError("");
    setNotice("");
    setSubmitting(true);
    const { error: resultError } = await authClient.signIn.magicLink({
      // expo client 把相对 callbackURL 改写为 openstarter:// 深链（@better-auth/expo）。
      callbackURL: "/",
      email,
    });
    setSubmitting(false);
    if (resultError) {
      setError(resultError.message ?? t("common.error.message"));
      return;
    }
    setNotice(t("common.sign.magic_link_sent"));
  };

  const handleEmailOtpRequest = async () => {
    setError("");
    setNotice("");
    setSubmitting(true);
    const { error: resultError } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });
    setSubmitting(false);
    if (resultError) {
      setError(resultError.message ?? t("common.error.message"));
      return;
    }
    setOtpInputMode(true);
  };

  const handleEmailOtpVerify = async () => {
    setError("");
    setSubmitting(true);
    const { error: resultError } = await authClient.signIn.emailOtp({
      callbackURL: "/",
      email,
      otp,
    });
    setSubmitting(false);
    if (resultError) {
      setError(resultError.message ?? t("common.error.message"));
    }
    // 成功后不手动跳转：门禁随会话变化接管。
  };

  const submitLabel = (() => {
    if (submitting) {
      return t("common.sign.sending");
    }
    return mode === "magic-link" ? t("common.sign.magic_link_send") : t("common.sign.otp_send");
  })();

  return (
    <View className="gap-3">
      <Text className="text-center text-muted-foreground text-xs dark:text-dark-muted-foreground">
        {t("common.sign.passwordless_title")}
      </Text>

      {modes.length > 1 && !otpInputMode ? (
        <View className="flex-row gap-2">
          {modes.map((modeItem) => (
            <View className="flex-1" key={modeItem}>
              <Button
                onPress={() => setMode(modeItem)}
                variant={mode === modeItem ? "default" : "outline"}
              >
                <Text>
                  {modeItem === "magic-link"
                    ? t("common.sign.mode_magic_link")
                    : t("common.sign.mode_email_code")}
                </Text>
              </Button>
            </View>
          ))}
        </View>
      ) : null}

      {otpInputMode ? (
        <View className="gap-3">
          <Text className="text-center text-muted-foreground text-xs dark:text-dark-muted-foreground">
            {t("common.sign.otp_sent_to", { email })}
          </Text>
          <Field
            accessibilityLabel={t("common.sign.otp_placeholder")}
            inputMode="numeric"
            label={t("common.sign.otp_placeholder")}
            onChangeText={setOtp}
            placeholder={t("common.sign.otp_placeholder")}
            value={otp}
          />
          <Button disabled={submitting} onPress={() => void handleEmailOtpVerify()}>
            <Text>{t("common.sign.otp_verify")}</Text>
          </Button>
          <Button onPress={() => setOtpInputMode(false)} variant="ghost">
            <Text>{t("common.sign.otp_back")}</Text>
          </Button>
        </View>
      ) : (
        <View className="gap-3">
          <Field
            autoComplete="email"
            inputMode="email"
            label={t("common.sign.email_title")}
            onBlur={() => undefined}
            onChangeText={setEmail}
            placeholder={t("common.sign.email_placeholder")}
            value={email}
          />
          <Button
            disabled={submitting}
            onPress={() => {
              const handler = mode === "magic-link" ? handleMagicLink : handleEmailOtpRequest;
              void handler();
            }}
          >
            <Text>{submitLabel}</Text>
          </Button>
        </View>
      )}

      {notice.length > 0 ? (
        <Text className="text-center text-muted-foreground text-xs dark:text-dark-muted-foreground">
          {notice}
        </Text>
      ) : null}
      {error.length > 0 ? (
        <Text className="text-center text-destructive text-xs dark:text-dark-destructive">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
