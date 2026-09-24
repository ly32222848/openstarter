import { Card, CardDescription, CardHeader, CardTitle } from "@openstarter/ui-web/components/card";
import {
  BadgeCheck,
  CreditCard,
  Database,
  Globe,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { m } from "@/paraglide/messages.js";

type FeatureKey =
  | "auth"
  | "payment"
  | "rbac"
  | "credits"
  | "cms"
  | "i18n";

const FEATURES: Array<{ icon: LucideIcon; key: FeatureKey }> = [
  { icon: ShieldCheck, key: "auth" },
  { icon: CreditCard, key: "payment" },
  { icon: Users, key: "rbac" },
  { icon: BadgeCheck, key: "credits" },
  { icon: Database, key: "cms" },
  { icon: Globe, key: "i18n" },
];

export function Features() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20" id="features">
      <div className="mb-12 text-center">
        <h2 className="font-bold text-3xl tracking-tight">
          {m["landing.features.title"]()}
        </h2>
        <p className="mt-2 text-muted-foreground">{m["landing.features.description"]()}</p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <Card key={feature.key}>
              <CardHeader>
                <Icon aria-hidden="true" className="mb-2 size-6 text-primary" />
                <CardTitle>{m[`landing.features.${feature.key}.title`]()}</CardTitle>
                <CardDescription>
                  {m[`landing.features.${feature.key}.description`]()}
                </CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
