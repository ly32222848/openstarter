// 设备授权（RFC 8628）人侧端点收敛。
//
// 这三个端点属于 Better-Auth 的 deviceAuthorization 插件（挂载于 /api/auth/*），
// 不在 Hono AppType 的类型化 RPC 内；better-fetch 1.x 的 authClient.$fetch 也
// 不暴露 raw Response（拿不到 error_description）。故统一在此模块内以集中式
// fetch 实现：路径单点定义、错误解析单点实现，页面组件不接触网络细节。

/** 设备授权端点基址（Better-Auth deviceAuthorization 插件挂载点）。 */
const DEVICE_ENDPOINT_BASE = "/api/auth/device";

/** 服务端返回的业务错误文案（Better-Auth 的 error_description 优先）。 */
async function serverErrorMessage(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.json()) as {
      error_description?: string;
      message?: string;
    };
    return body.error_description ?? body.message;
  } catch {
    // 非 JSON 响应（如纯文本错误页）无法解析，交由调用方回退本地化文案。
    return undefined;
  }
}

/** 设备授权流程错误；detail 为服务端给定的业务文案，可能为空。 */
export class DeviceFlowError extends Error {
  readonly detail: string | undefined;

  constructor(detail?: string) {
    super(detail ?? "device authorization failed");
    this.name = "DeviceFlowError";
    this.detail = detail;
  }
}

async function assertOk(res: Response): Promise<void> {
  if (res.ok) {
    return;
  }
  throw new DeviceFlowError(await serverErrorMessage(res));
}

/** 把当前登录会话 claim 到该设备码（GET /api/auth/device）。 */
export async function claimDevice(userCode: string): Promise<void> {
  const res = await fetch(
    `${DEVICE_ENDPOINT_BASE}?user_code=${encodeURIComponent(userCode)}`,
    { method: "GET" },
  );
  await assertOk(res);
}

/** 批准该设备码登录（POST /api/auth/device/approve，靠会话 cookie 鉴权）。 */
export async function approveDevice(userCode: string): Promise<void> {
  const res = await fetch(`${DEVICE_ENDPOINT_BASE}/approve`, {
    body: JSON.stringify({ userCode }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  await assertOk(res);
}

/** 拒绝该设备码登录（POST /api/auth/device/deny）。 */
export async function denyDevice(userCode: string): Promise<void> {
  const res = await fetch(`${DEVICE_ENDPOINT_BASE}/deny`, {
    body: JSON.stringify({ userCode }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  await assertOk(res);
}
