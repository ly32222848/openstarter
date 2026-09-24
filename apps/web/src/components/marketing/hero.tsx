import { Button } from "@openstarter/ui-web/components/button";
import { Link } from "@tanstack/react-router";

import { m } from "@/paraglide/messages.js";

export function Hero() {
  return (
    <section className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-20 text-center">
      <h1 className="font-bold text-4xl tracking-tight sm:text-5xl">
        {m["landing.hero.headline"]()}
      </h1>
      <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
        {m["landing.hero.subheadline"]()}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild size="lg">
          <Link to="/login">{m["landing.hero.cta"]()}</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link to="/pricing">{m["landing.pricing.title"]()}</Link>
        </Button>
      </div>
      <div className="mt-8 w-full rounded-xl border bg-gradient-to-b from-muted/50 to-muted/10 p-2 shadow-sm dark:shadow-[0_0_15px_rgba(110,231,183,0.1)]">
        <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-card text-muted-foreground text-sm">
          {m["landing.hero.preview"]()}
        </div>
      </div>
    </section>
  );
}
