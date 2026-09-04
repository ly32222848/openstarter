// 购买确认轮询状态机（Task B5）。
//
// RC 付费墙回调成功 ≠ 服务端已建订阅：webhook 有 5-60s 的到达窗口。
// 购买完成后有界轮询 plan/credits（默认 2s × 15 次 = 30s），三态收敛：
//   - confirmed：服务端已反映购买，界面刷新即可；
//   - timeout：窗口耗尽仍未确认 —— UI 显示 purchase_processing 兜底文案，
//     webhook 仍是唯一事实来源，customerInfo 监听/下次拉取会补上。
//
// 纯函数设计：时钟与探测函数都由调用方注入，测试无需 mock timers。

/** 轮询结果：确认 / 窗口耗尽。pending 不是终态，不对外暴露。 */
export type PurchaseConfirmationResult =
  | { status: "confirmed" }
  | { status: "timeout" };

export interface PurchaseConfirmationOptions {
  /** 时钟（注入以便测试）。 */
  clock: { now: () => number };
  /** 单次探测：返回 true 表示服务端已反映购买。抛错按"本次未确认"处理。 */
  poll: () => Promise<boolean>;
  /** 轮询间隔，默认 2s。 */
  intervalMs?: number;
  /** 总等待上限，默认 30s（2s × 15 次）。 */
  maxWaitMs?: number;
  /** 间隔等待钩子（生产传 sleep，测试可省 —— 假时钟无需真实等待）。 */
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_INTERVAL_MS = 2_000;
const DEFAULT_MAX_WAIT_MS = 30_000;

export async function runPurchaseConfirmation(
  options: PurchaseConfirmationOptions,
): Promise<PurchaseConfirmationResult> {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
  const sleep = options.sleep ?? (async () => undefined);

  // 至少探测一次：即使 maxWaitMs=0，也给服务端一次即时确认的机会。
  // 绝不依赖真实时钟推进：以"探测次数"为硬上限（deadline = maxWaitMs/intervalMs + 1），
  // 时钟只用于已流逝时间的展示语义。这样假时钟（now 恒定）也不会死循环。
  const startedAt = options.clock.now();
  const maxAttempts = Math.max(1, Math.ceil(maxWaitMs / intervalMs) + 1);
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let confirmed = false;
    try {
      confirmed = await options.poll();
    } catch {
      // 探测失败（网络抖动）视作本次未确认，继续等待。
      confirmed = false;
    }
    if (confirmed) {
      return { status: "confirmed" };
    }
    const elapsed = options.clock.now() - startedAt;
    if (elapsed >= maxWaitMs) {
      return { status: "timeout" };
    }
    await sleep(intervalMs);
  }
  return { status: "timeout" };
}
