import { Button } from "@openstarter/ui-web/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@openstarter/ui-web/components/card";
import { cn } from "@openstarter/ui-web/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { m } from "@/paraglide/messages.js";
import { PRICING_TIERS, type PricingCheckout, type PricingTier } from "@/lib/marketing/pricing";
import { checkout } from "@/modules/checkout/lib/api";

// qrcode.react（微信支付二维码渲染）仅在某次结账产生二维码时才需要，惰性加载避免
// 拖进营销首屏包；type-only 的 WechatQr 在编译期被擦除，不产生运行时依赖。
import type { WechatQr } from "./wechat-qr-overlay";

const WechatQrOverlay = lazy(() =>
  import("./wechat-qr-overlay").then((m) => ({ default: m.WechatQrOverlay })),
);

function formatPrice(price: number | "custom"): string {
  if (price === "custom") {
    return m["landing.pricing.enterprise.custom"]();
  }
  if (price === 0) {
    return m["landing.pricing.starter.free"]();
  }
  return `$${price}/${m["landing.pricing.monthly.unit"]()}`;
}

// 每个套餐展示的 feature 消息键（zh/en 语言包已内置对应词条）。
const PRICING_FEATURE_KEYS: Record<PricingTier["id"], string[]> = {
  starter: ["feature_1_project", "feature_5k_credits", "feature_email_support"],
  pro: [
    "feature_unlimited_projects",
    "feature_50k_credits",
    "feature_priority_support",
    "feature_email_support",
  ],
  enterprise: [
    "feature_unlimited_credits",
    "feature_api_access",
    "feature_custom_integrations",
    "feature_dedicated_support",
  ],
};

const PRICING_CTA_KEYS: Record<PricingTier["id"], string> = {
  starter: "starter_cta",
  pro: "pro_cta",
  enterprise: "enterprise_cta",
};

function TierCard({
  tier,
  pending,
  onCheckout,
}: {
  tier: PricingTier;
  pending: boolean;
  onCheckout: (checkout: PricingCheckout) => void;
}) {
  const Icon = tier.icon;
  const { cta } = tier;
  return (
    <Card className={cn(tier.highlight && "ring-2 ring-primary")}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Icon aria-hidden="true" className="size-5 text-primary" />
          {tier.highlight ? (
            <span className="rounded-full bg-primary px-2 py-0.5 text-primary-foreground text-xs">
              {m["landing.pricing.popular"]()}
            </span>
          ) : null}
        </div>
        <CardTitle className="mt-2 text-lg">
          {m[`landing.pricing.${tier.id}`]()}
        </CardTitle>
        <CardDescription>{m[`landing.pricing.${tier.id}_desc`]()}</CardDescription>
        <div className="mt-2 font-bold text-2xl">{formatPrice(tier.priceMonthly)}</div>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="flex flex-col gap-2">
          {PRICING_FEATURE_KEYS[tier.id].map((key) => (
            <li className="flex items-center gap-2" key={key}>
              <Check aria-hidden="true" className="size-4 text-primary" />
              <span>{m[`landing.pricing.${key}`]()}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        {cta.kind === "link" ? (
          <Button asChild className="w-full" variant={tier.highlight ? "default" : "outline"}>
            <Link to={cta.to}>{m[`landing.pricing.${PRICING_CTA_KEYS[tier.id]}`]()}</Link>
          </Button>
        ) : (
          <Button
            className="w-full"
            disabled={pending}
            onClick={() => onCheckout(cta.checkout)}
            type="button"
            variant={tier.highlight ? "default" : "outline"}
          >
            {m[`landing.pricing.${PRICING_CTA_KEYS[tier.id]}`]()}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export function PricingSection() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const [wechatQr, setWechatQr] = useState<WechatQr | null>(null);

  const checkoutMutation = useMutation({
    ...checkout.mutations.create(),
    onError: (err) => {
      toast.error(err.message);
    },
    onSuccess: (data) => {
      // 微信 Native 渠道：渲染二维码扫码支付；其余渠道：跳转结账链接（R10.3）。
      if (data.qrData?.codeUrl) {
        if (!data.orderNo) {
          toast.error(m["landing.pricing.error_missing_order"]());
          return;
        }
        setWechatQr({
          amount: data.qrData.amount,
          codeUrl: data.qrData.codeUrl,
          orderNo: data.orderNo,
        });
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      toast.error(m["landing.pricing.error_checkout"]());
    },
  });

  function handleCheckout(input: PricingCheckout) {
    // 未登录用户发起结账 → 重定向到登录页（R10.2）。
    if (!session?.user) {
      navigate({ to: "/login" });
      return;
    }
    checkoutMutation.mutate(input);
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-20" id="pricing">
      <div className="mb-12 text-center">
        <h2 className="font-bold text-3xl tracking-tight">{m["landing.pricing.title"]()}</h2>
        <p className="mt-2 text-muted-foreground">{m["landing.pricing.description"]()}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {PRICING_TIERS.map((tier) => (
          <TierCard
            key={tier.id}
            onCheckout={handleCheckout}
            pending={checkoutMutation.isPending}
            tier={tier}
          />
        ))}
      </div>
      {wechatQr ? (
        <Suspense fallback={null}>
          <WechatQrOverlay onClose={() => setWechatQr(null)} qr={wechatQr} />
        </Suspense>
      ) : null}
    </section>
  );
}
