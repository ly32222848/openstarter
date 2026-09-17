import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";

import { Faq } from "@/components/marketing/faq";
import { Features } from "@/components/marketing/features";
import { Hero } from "@/components/marketing/hero";
import { PricingSection } from "@/components/marketing/pricing-section";
import { captureReferralAttribution } from "@/lib/referral-attribution";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/branding";
import { buildPageHead } from "@/lib/page-head";

const marketingSearchSchema = z.object({ ref: z.string().optional() });

export const Route = createFileRoute("/_marketing/")({
  validateSearch: marketingSearchSchema,
  head: () =>
    buildPageHead({
      title: BRAND_NAME,
      description: BRAND_TAGLINE,
      path: "/",
    }),
  component: LandingPage,
});

function LandingPage() {
  const { ref } = Route.useSearch();
  useEffect(() => {
    if (ref) {
      captureReferralAttribution(ref);
    }
  }, [ref]);

  return (
    <>
      <Hero />
      <Features />
      <PricingSection />
      <Faq />
    </>
  );
}
