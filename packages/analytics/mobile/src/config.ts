// 构建期 env（EXPO_PUBLIC_*，见 apps/mobile/.env.example）→ 门面配置的解析层。
//
// 移动端分析供应商不再由 web 管理端（/api/analytics/config）控制，改为随构建固化：
// App 是静态二进制，管理端改配置触达不到已发布的安装包，env 可按 EAS profile /
// 本地 .env 逐渠道固化。env 由 Expo 在构建期内联进 bundle，但仍属外部输入
// （fork 者可能配置任何值）：逐键校验类型、去空白，非法/缺失一律归零值。
// 任何输入都不抛错。

/** 门面初始化所需的移动端分析配置（已归一）。 */
export interface MobileAnalyticsConfig {
  gaMobileEnabled: boolean;
  openpanelClientId: string;
  openpanelClientSecret: string;
}

/** 构建期 env 的形态：键固定、值可能缺失（process.env 的常态）。 */
export type AnalyticsEnv = Record<string, string | undefined>;

/** env 键名 —— 与 apps/mobile/.env.example 保持一致。 */
export const ANALYTICS_ENV_KEYS = {
  gaEnabled: "EXPO_PUBLIC_ANALYTICS_GA_ENABLED",
  openpanelClientId: "EXPO_PUBLIC_ANALYTICS_OPENPANEL_CLIENT_ID",
  openpanelClientSecret: "EXPO_PUBLIC_ANALYTICS_OPENPANEL_CLIENT_SECRET",
} as const;

/** 未配置任何供应商时的零值配置。 */
const DISABLED_CONFIG: MobileAnalyticsConfig = {
  gaMobileEnabled: false,
  openpanelClientId: "",
  openpanelClientSecret: "",
};

/** 读取字符串键：非 string 或缺失返回 null（0 值由调用方归一）。 */
function readStringKey(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * 解析分析 env（不信任输入 shape，永不抛错）。
 * - openpanel 两键非空才视为已配置 OP（半配置视为未配置）；
 * - GA 开关严格 `=== "true"`（与原服务端开关语义一致）。
 */
export function resolveMobileAnalyticsConfig(
  env: AnalyticsEnv | undefined | null,
): MobileAnalyticsConfig {
  if (!env || typeof env !== "object") {
    return DISABLED_CONFIG;
  }

  return {
    gaMobileEnabled: env[ANALYTICS_ENV_KEYS.gaEnabled] === "true",
    openpanelClientId: readStringKey(env[ANALYTICS_ENV_KEYS.openpanelClientId]) ?? "",
    openpanelClientSecret: readStringKey(env[ANALYTICS_ENV_KEYS.openpanelClientSecret]) ?? "",
  };
}
