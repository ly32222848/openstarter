import type { ExpoConfig } from "expo/config";

// scheme 必须与 packages/auth/src/server.ts 的 trustedOrigins("openstarter://")
// 以及 expoClient({ scheme }) 三处同名，否则 OAuth 深链回跳不会落回应用。
// bundleIdentifier / package 两端取同一值，避免深链与 OAuth 回调配置分叉；
// 该值还必须与服务端 APPLE_APP_BUNDLE_IDENTIFIER 环境变量一致，否则 Apple 登录不通。
const BUNDLE_IDENTIFIER = "dev.openstarter.app";

const config: ExpoConfig = {
  android: {
    package: BUNDLE_IDENTIFIER,
  },
  ios: {
    bundleIdentifier: BUNDLE_IDENTIFIER,
    supportsTablet: true,
    // Apple 登录（servicesIdentityKey 由 expo-apple-authentication 运行时处理）：
    // Sign in with Apple entitlement 是 App Store 审核的硬性要求 —— 只要应用
    // 提供任何第三方登录（Google），就必须同时提供 Apple 登录（指南 4.8）。
    entitlements: {
      "com.apple.developer.applesignin": ["Default"],
    },
  },
  name: "OpenStarter",
  orientation: "portrait",
  // expo-secure-store 的 config plugin 是 requireAuthentication 等原生能力的前提；
  // expo-router 插件启用文件式路由。
  // RevenueCat（react-native-purchases）无需 config plugin，仅要求 dev client/prebuild
  // （StoreKit / In-App Purchase 能力在 Xcode 侧启用）。
  // with-firebase-config 在两个 Firebase 配置文件都缺失时 no-op。
  plugins: ["expo-router", "expo-secure-store", "./plugins/with-firebase-config"],
  scheme: "openstarter",
  slug: "openstarter",
  userInterfaceStyle: "automatic",
  version: "0.1.0",
  // EAS 项目 ID：`eas init` 后由用户回填（eas init 只会补丁 app.json，不会改本文件）。
  // 缺失时 eas build/submit 会报 "project not linked"，属预期占位而非配置错误。
  extra: {
    // eas: {
    //   projectId: "00000000-0000-0000-0000-000000000000",
    // },
  },
};

export default config;
