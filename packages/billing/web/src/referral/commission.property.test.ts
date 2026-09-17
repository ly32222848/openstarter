import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { calcCommissionCredits, resolveRate } from "./commission";

describe("佣金数学属性", () => {
  it("正基数 × 正比例 → 非负整数", () => {
    fc.assert(
      fc.property(fc.nat(1_000_000), fc.integer({ min: 1, max: 5000 }), (base, rate) => {
        const credits = calcCommissionCredits(base, rate);
        expect(credits).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(credits)).toBe(true);
      }),
    );
  });

  it("比例解析始终有值且在 [0, 5000] 内", () => {
    fc.assert(
      fc.property(
        fc.option(fc.integer({ min: 0, max: 5000 }), { nil: null }),
        fc.integer({ min: 0, max: 5000 }),
        (custom, def) => {
          const rate = resolveRate(custom, def);
          expect(rate).toBeGreaterThanOrEqual(0);
          expect(rate).toBeLessThanOrEqual(5000);
        },
      ),
    );
  });

  it("同比例下佣金随基数单调不减", () => {
    fc.assert(
      fc.property(
        fc.nat(1_000_000),
        fc.nat(1_000_000),
        fc.integer({ min: 1, max: 5000 }),
        (a, b, rate) => {
          const [lo, hi] = a <= b ? [a, b] : [b, a];
          expect(calcCommissionCredits(hi, rate)).toBeGreaterThanOrEqual(
            calcCommissionCredits(lo, rate),
          );
        },
      ),
    );
  });
});
