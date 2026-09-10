// Provider 注册表（spec §3）：唯一切换点。新增供应商 = 新建 provider 目录 +
// 此处一行；业务侧（apps/mobile）零改动。静态 import 两个 client strategy：
// 只有被选中的 provider 会 configure 原生 SDK（未选中方不挂载 Provider）。
import { strategy as revenuecatStrategy } from "./providers/revenuecat";
import { strategy as superwallStrategy } from "./providers/superwall";
import { resolveBillingProvider } from "./resolve-provider";

import { BillingProvider } from "./providers/types";
import type { BillingProviderClientStrategy } from "./providers/types";

const REGISTRY = {
  [BillingProvider.REVENUECAT]: revenuecatStrategy,
  [BillingProvider.SUPERWALL]: superwallStrategy,
} as const satisfies Record<BillingProvider, BillingProviderClientStrategy>;

export const strategy: BillingProviderClientStrategy =
  REGISTRY[resolveBillingProvider(process.env)];
