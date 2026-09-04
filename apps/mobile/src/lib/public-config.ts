// apps/mobile/src/lib/public-config.ts —— 由 GET /api/config/public 决定登录页展示什么。
//
// 为什么不能硬编码按钮：packages/auth/src/server.ts 里 Google / GitHub / Apple 是
// **条件注册**的，开关关闭时对应端点根本不存在。硬编码的结果是用户点一下拿到 404
// （见 spec §6）。该端点本就是为登录页设计的（见 packages/api/src/routes/config.ts 注释）。
//
// 开关语义不统一，逐条对齐服务端，不要"顺手统一"：
//   - <provider>_auth_enabled：严格 === "true"，缺失即关闭（服务端 isEnabled 就是严格比较）；
//     与 apps/web 的 getEnabledOAuthProviders 保持一致 —— 两个客户端读同一端点必须给同一结论。
//   - email_auth_enabled：!== "false"，缺失即开启（服务端派生 password_reset_enabled 时就是这么判的）。
//   - password_reset_enabled：服务端已派生（还额外要求邮件渠道配置完成），直接读。
//
// 已知局限：服务端注册 provider 还要求 env 里的 client id/secret 齐备，而本端点
// 不下发 secret 是否存在。开关开着但凭据缺失时，按钮仍会渲染并 404。
// apps/web 有完全相同的局限；要修应该修端点，而不是在单个客户端打补丁。

// v1 支持的社交登录方式（spec §2 决策表：邮箱密码 + Google/Apple）。
// 要加 GitHub：把 "github" 加进这个元组，并在登录页补一个按钮即可。
export const MOBILE_SOCIAL_PROVIDERS = ["google", "apple"] as const;

export type MobileSocialProvider = (typeof MOBILE_SOCIAL_PROVIDERS)[number];

export type PublicConfig = Record<string, string>;

export interface EnabledAuthMethods {
  emailPassword: boolean;
  passwordReset: boolean;
  socialProviders: MobileSocialProvider[];
}

const SWITCH_KEYS: Record<MobileSocialProvider, string> = {
  apple: "apple_auth_enabled",
  google: "google_auth_enabled",
};

export function resolveEnabledProviders(config: PublicConfig): EnabledAuthMethods {
  const socialProviders: MobileSocialProvider[] = [];
  for (const provider of MOBILE_SOCIAL_PROVIDERS) {
    if (config[SWITCH_KEYS[provider]] === "true") {
      socialProviders.push(provider);
    }
  }

  return {
    emailPassword: config.email_auth_enabled !== "false",
    passwordReset: config.password_reset_enabled === "true",
    socialProviders,
  };
}

/** 无密码登录模式：magic link（点邮件里的链接）或 email OTP（回填验证码）。 */
export type PasswordlessMode = "email-otp" | "magic-link";

export interface EnabledPasswordlessModes {
  emailOtp: boolean;
  magicLink: boolean;
}

/**
 * 由公开配置解析可用的无密码模式（严格 === "true"，对齐服务端 isEnabled）。
 * 两个开关都关时返回空集合 —— 调用方据此不渲染无密码入口。
 */
export function resolvePasswordlessModes(config: PublicConfig): EnabledPasswordlessModes {
  return {
    emailOtp: config.email_otp_enabled === "true",
    magicLink: config.magic_link_enabled === "true",
  };
}

/**
 * IAP 付费墙开关（revenuecat_enabled，由 /api/config/public 白名单下发）。
 *
 * 严格 === "true" 对齐服务端 isEnabled。注意这只是两个必要条件之一：
 * RC SDK key（env）与该开关同时满足才展示付费墙 —— key 缺失时 SDK 无法
 * configure，开关开着也只能显示购买按钮收不到事件。
 */
export function resolveIapEnabled(config: PublicConfig): boolean {
  return config.revenuecat_enabled === "true";
}
