import { zValidator } from "@hono/zod-validator";
import { respData, respErr, respOk, respPage } from "@openstarter/shared";
import { Hono } from "hono";
import { z } from "zod";

import { idParam, paginationSchema } from "../../../schema";
import { requireAuth } from "../../../middleware/auth";
import { requirePermission } from "../../../middleware/rbac";

import {
  getReferralConfigForAdmin,
  listCommissions,
  listRelations,
  manualCreateCommission,
  saveReferralConfig,
  setCustomRate,
  settleCommission,
  voidCommission,
} from "./service";

const PERMISSION_ADMIN = "admin.*";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const referralConfigSchema = z.object({
  enabled: z.boolean().default(true),
  defaultRate: z.number().int().min(0).max(5000).default(1000),
  minSettleCredits: z.number().int().min(0).default(100),
});

const commissionsQuery = paginationSchema.extend({
  status: z.string().min(1).optional(),
});

const manualCreateBody = z.object({
  baseAmount: z.number().int().min(0),
  orderNo: z.string().min(1).max(64),
  rate: z.number().int().min(0).max(5000),
  referredUserId: z.string().min(1),
  referrerId: z.string().min(1),
});

const rateBody = z.object({
  customRate: z.number().int().min(0).max(5000).nullable(),
});

// ─── Router ───────────────────────────────────────────────────────────────────

export const referralAdminRouter = new Hono()
  .use(requireAuth)
  .use(requirePermission(PERMISSION_ADMIN))
  // ── 配置 ─────────────────────────────────────────────────────────────────────
  .get("/config", async (c) => {
    const result = await getReferralConfigForAdmin();
    return c.json(respData(result.data));
  })
  .put("/config", zValidator("json", referralConfigSchema), async (c) => {
    const body = c.req.valid("json");
    const result = await saveReferralConfig(body);
    if (!result.ok) {
      return c.json(respErr(result.error ?? "save_failed"), 422);
    }
    return c.json(respOk());
  })
  // ── 佣金管理 ────────────────────────────────────────────────────────────────
  .get("/commissions", zValidator("query", commissionsQuery), async (c) => {
    const { page, pageSize, status } = c.req.valid("query");
    const { items, total } = await listCommissions({ page, pageSize, status });
    return c.json(respPage(items, total));
  })
  .post("/commissions/:id/settle", zValidator("param", idParam), async (c) => {
    const { id } = c.req.valid("param");
    const adminUserId = c.get("userId");
    const result = await settleCommission({ adminUserId, commissionId: id });
    if (result.error === "NOT_FOUND") {
      return c.json(respErr("not_found"), 404);
    }
    if (result.error === "NOT_PENDING") {
      return c.json(respErr("NOT_PENDING"), 409);
    }
    if (result.error === "GRANT_FAILED") {
      return c.json(respErr("grant_failed"), 500);
    }
    return c.json(respData({ transactionNo: result.transactionNo }));
  })
  .post("/commissions/:id/void", zValidator("param", idParam), async (c) => {
    const { id } = c.req.valid("param");
    const result = await voidCommission({ commissionId: id });
    if (result.error === "NOT_FOUND") {
      return c.json(respErr("not_found"), 404);
    }
    if (result.error === "NOT_PENDING") {
      return c.json(respErr("NOT_PENDING"), 409);
    }
    return c.json(respOk());
  })
  .post("/commissions", zValidator("json", manualCreateBody), async (c) => {
    const body = c.req.valid("json");
    const result = await manualCreateCommission(body);
    return c.json(respData(result.data));
  })
  // ── 关系列表 ────────────────────────────────────────────────────────────────
  .get("/relations", zValidator("query", paginationSchema), async (c) => {
    const { page, pageSize } = c.req.valid("query");
    const { items, total } = await listRelations({ page, pageSize });
    return c.json(respPage(items, total));
  })
  // ── 代理比例 ────────────────────────────────────────────────────────────────
  .put("/users/:id/rate", zValidator("param", idParam), zValidator("json", rateBody), async (c) => {
    const { id } = c.req.valid("param");
    const { customRate } = c.req.valid("json");
    await setCustomRate({ userId: id, customRate });
    return c.json(respOk());
  });
