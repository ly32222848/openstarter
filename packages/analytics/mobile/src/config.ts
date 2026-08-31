// GET /api/analytics/config 响应 → 门面配置的解析层。
//
// 响应 shape 由服务端 PublicAnalyticsConfig 决定（见
// packages/api/src/modules/admin/analytics/service.ts），但本包不 import
// 服务端类型 —— 移动端对响应永远持不信任态度（外部数据边界）：
// 逐键校验类型、去空白，非法/缺失一律归零值。任何 shape 都不抛错。

/** 门面初始化所需的移动端分析配置（已归一）。 */
export interface MobileAnalyticsConfig {
  gaMobileEnabled: boolean;
  openpanelClientId: string;
  openpanelClientSecret: string;
}

/** 未配置任何供应商时的零值配置。 */
const DISABLED_CONFIG: MobileAnalyticsConfig = {
  gaMobileEnabled: false,
  openpanelClientId: "",
  openpanelClientSecret: "",
};

/** 读取字符串键：非 string 或缺失返回 null（0 值由调用方归一）。 */
function readStringKey(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * 解析公开分析配置响应（不信任外部 shape，永不抛错）。
 * - openpanel 两键非空才视为已配置 OP；
 * - gaMobileEnabled 严格 `=== "true"`（与服务端开关语义一致）。
 */
export function resolveMobileAnalyticsConfig(
  response: Record<string, unknown> | undefined | null,
): MobileAnalyticsConfig {
  if (!response || typeof response !== "object") {
    return DISABLED_CONFIG;
  }

  return {
    gaMobileEnabled: response.gaMobileEnabled === "true",
    openpanelClientId: readStringKey(response, "openpanelClientId") ?? "",
    openpanelClientSecret: readStringKey(response, "openpanelClientSecret") ?? "",
  };
}
