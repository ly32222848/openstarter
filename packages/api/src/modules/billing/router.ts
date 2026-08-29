import { zValidator } from "@hono/zod-validator";
import {
  createCheckout,
  type PaymentOrder,
  PaymentProviderUnavailableError,
  getPaymentManager,
  handlePaymentEvent,
  type PaymentEvent,
} from "@openstarter/billing-web/payment";
import { respData, respErr } from "@openstarter/shared";
import { logger } from "@openstarter/shared/logger";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

import { requireAuth } from "../../middleware/auth";
import { resolveProduct } from "./products";

const PROVIDER_UNAVAILABLE_STATUS = 400;
const UNAUTHORIZED = 401;
const UNKNOWN_PRODUCT_STATUS = 400;

// 结账入参：只接受产品引用与支付渠道。价格/货币/积分/订阅周期一律由服务端
// 产品目录（./products）按 productId 解析 —— 客户端传金额一律忽略，
// 杜绝「客户端改价」漏洞。
const checkoutBody = z.object({
  productId: z.string().min(1),
  provider: z.string().min(1).optional(),
});

export const billingRouter = new Hono()
  .post("/checkout", requireAuth, zValidator("json", checkoutBody), async (c) => {
    const body = c.req.valid("json");
    const session = c.get("session");
    const origin = new URL(c.req.url).origin;

    // 服务端定价：未知产品直接拒绝，不落任何订单。
    const product = resolveProduct(body.productId);
    if (!product) {
      throw new HTTPException(UNKNOWN_PRODUCT_STATUS, {
        message: `unknown product: ${body.productId}`,
      });
    }

    const paymentOrder: PaymentOrder = {
      cancelUrl: `${origin}/pricing`,
      description: product.productName,
      price: { amount: product.amount, currency: product.currency },
      productId: product.productId,
      successUrl: `${origin}/dashboard?checkout=success`,
      type: product.type,
    };

    if (product.type === "subscription") {
      paymentOrder.plan = {
        interval: product.interval ?? "month",
        intervalCount: product.intervalCount,
        name: product.planName ?? product.productName,
      };
    }

    try {
      const result = await createCheckout({
        credits: product.credits,
        creditsValidDays: product.creditsValidDays,
        paymentOrder,
        planName: product.planName,
        productName: product.productName,
        provider: body.provider,
        userEmail: session?.user?.email,
        userId: c.get("userId"),
      });

      return c.json(
        respData({
          checkoutUrl: result.checkoutUrl,
          orderNo: result.orderNo,
          provider: result.provider,
          qrData: result.qrData,
        }),
      );
    } catch (err) {
      if (err instanceof PaymentProviderUnavailableError) {
        throw new HTTPException(PROVIDER_UNAVAILABLE_STATUS, {
          message: err.message,
        });
      }
      throw err;
    }
  })
  .post("/payment/webhook/:provider", async (c) => {
    const providerName = c.req.param("provider");

    // 解析渠道 provider：未启用/未知渠道无凭证可验签 —— fail-closed 拒绝（R12.2）。
    const manager = await getPaymentManager();
    const provider = manager.getProvider(providerName);
    if (!provider) {
      logger.warn(`[webhook] provider unavailable, rejecting callback: ${providerName}`);
      return c.json(respErr("unauthorized"), UNAUTHORIZED);
    }

    // 验签并取归一化事件（R12.1）。验签失败一律拒绝且零副作用（R12.2）。
    let event: PaymentEvent;
    try {
      event = await provider.getPaymentEvent({ req: c.req.raw });
    } catch (err) {
      logger.warn(
        `[webhook] signature verification failed: ${providerName} - ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return c.json(respErr("invalid webhook signature"), UNAUTHORIZED);
    }

    // 验签通过后再做业务编排（R12.3/R12.4/R12.5）；编排异常交由 app.onError 统一处理。
    await handlePaymentEvent(event, providerName);

    return c.json(respData({ received: true }));
  });
