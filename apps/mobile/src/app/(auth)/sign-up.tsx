import { useForm } from "@tanstack/react-form";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "@openstarter/i18n-mobile";
import { Button, Field, Text } from "@openstarter/ui-mobile";
import z from "zod";

import { Screen } from "@/components/ui/screen";
import { authClient } from "@/lib/auth-client";

const MIN_PASSWORD_LENGTH = 8;
const MIN_NAME_LENGTH = 2;

export default function SignUpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [error, setError] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);

  const form = useForm({
    defaultValues: { email: "", name: "", password: "" },
    onSubmit: async ({ value }) => {
      setError("");
      const result = await authClient.signUp.email({
        email: value.email,
        name: value.name,
        password: value.password,
      });
      if (result.error) {
        // 邮箱未验证（重复注册已验证账号等场景）：转 verify-email 屏处理。
        if (result.error.code === "EMAIL_NOT_VERIFIED") {
          authClient.sendVerificationEmail({ email: value.email }).catch(() => undefined);
          router.replace({
            pathname: "/verify-email",
            params: { email: value.email },
          });
          return;
        }
        setError(result.error.message ?? "Sign up failed");
        return;
      }
      // 服务端可能要求邮箱验证（REQUIRE_EMAIL_VERIFICATION）。此时不会立即产生会话，
      // 门禁也就不会跳转，因此给出明确提示而不是让人盯着不动的界面。
      setPendingVerification(true);
    },
    validators: {
      onSubmit: z.object({
        email: z.email("Invalid email address"),
        name: z.string().min(MIN_NAME_LENGTH, "Name is too short"),
        password: z.string().min(MIN_PASSWORD_LENGTH, "Password must be at least 8 characters"),
      }),
    },
  });

  return (
    <Screen>
      <View className="flex-1 justify-center gap-5 p-6">
        <Text className="text-center font-bold text-2xl text-foreground dark:text-dark-foreground">
          {t("common.sign.sign_up_title")}
        </Text>

        <View className="gap-4">
          <form.Field name="name">
            {(field) => (
              <Field
                autoComplete="name"
                errors={field.state.meta.errors.map((item) => item?.message ?? "")}
                label={t("common.sign.name_title")}
                onBlur={field.handleBlur}
                onChangeText={field.handleChange}
                placeholder={t("common.sign.name_placeholder")}
                value={field.state.value}
              />
            )}
          </form.Field>

          <form.Field name="email">
            {(field) => (
              <Field
                autoComplete="email"
                errors={field.state.meta.errors.map((item) => item?.message ?? "")}
                label={t("common.sign.email_title")}
                onBlur={field.handleBlur}
                onChangeText={field.handleChange}
                placeholder={t("common.sign.email_placeholder")}
                value={field.state.value}
              />
            )}
          </form.Field>

          <form.Field name="password">
            {(field) => (
              <Field
                autoComplete="password"
                errors={field.state.meta.errors.map((item) => item?.message ?? "")}
                label={t("common.sign.password_title")}
                onBlur={field.handleBlur}
                onChangeText={field.handleChange}
                placeholder={t("common.sign.password_placeholder")}
                secureTextEntry
                value={field.state.value}
              />
            )}
          </form.Field>

          <form.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting,
            })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button
                disabled={!canSubmit || isSubmitting}
                onPress={() => {
                  form.handleSubmit();
                }}
              >
                <Text>{t("common.sign.sign_up_title")}</Text>
              </Button>
            )}
          </form.Subscribe>
        </View>

        {pendingVerification ? (
          <View className="gap-2">
            <Text className="text-center text-muted-foreground text-sm dark:text-dark-muted-foreground">
              {t("common.sign.sign_up_description")}
            </Text>
            <Button
              onPress={() => {
                authClient
                  .sendVerificationEmail({ email: form.state.values.email })
                  .catch(() => undefined);
                router.replace({
                  pathname: "/verify-email",
                  params: { email: form.state.values.email },
                });
              }}
              variant="outline"
            >
              <Text>{t("common.sign.resend_verification")}</Text>
            </Button>
          </View>
        ) : null}

        {error.length > 0 ? (
          <Text className="text-center text-destructive text-sm dark:text-dark-destructive">
            {error}
          </Text>
        ) : null}

        <Link asChild href="/sign-in">
          <Text className="text-center text-foreground text-sm dark:text-dark-foreground">
            {t("common.sign.already_have_account")}
          </Text>
        </Link>
      </View>
    </Screen>
  );
}
