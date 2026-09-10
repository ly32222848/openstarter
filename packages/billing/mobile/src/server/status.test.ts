// 状态取值以 packages/billing/web/src/payment/types.ts 的归一化值为基准（spec §5）。
// 字面量镜像断言（不跨包 import），漂移即测试失败。
import { describe, expect, it } from "vitest";

import { PaymentStatus, SubscriptionStatus } from "./status";

describe("server status constants", () => {
  it("payment statuses match billing-web normalized values", () => {
    expect(PaymentStatus.PROCESSING).toBe("processing");
    expect(PaymentStatus.SUCCESS).toBe("paid");
    expect(PaymentStatus.FAILED).toBe("failed");
    expect(PaymentStatus.CANCELED).toBe("canceled");
  });

  it("subscription statuses include all billing-web normalized values", () => {
    expect(SubscriptionStatus.ACTIVE).toBe("active");
    expect(SubscriptionStatus.PENDING_CANCEL).toBe("pending_cancel");
    expect(SubscriptionStatus.CANCELED).toBe("canceled");
    expect(SubscriptionStatus.TRIALING).toBe("trialing");
    expect(SubscriptionStatus.EXPIRED).toBe("expired");
    expect(SubscriptionStatus.PAUSED).toBe("paused");
  });

  it("carries upstream-only extensions for unwired mappers", () => {
    expect(SubscriptionStatus.PAST_DUE).toBe("past_due");
    expect(SubscriptionStatus.UNPAID).toBe("unpaid");
    expect(SubscriptionStatus.INCOMPLETE).toBe("incomplete");
  });
});
