import { ChevronDown } from "lucide-react";

import { m } from "@/paraglide/messages.js";

const FAQ_KEYS = [
  "stack",
  "database",
  "payment",
  "license",
  "customize",
] as const;

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-20">
      <div className="mb-12 text-center">
        <h2 className="font-bold text-3xl tracking-tight">{m["landing.faq.title"]()}</h2>
        <p className="mt-2 text-muted-foreground">{m["landing.faq.description"]()}</p>
      </div>
      <div className="flex flex-col gap-3">
        {FAQ_KEYS.map((key) => (
          <details className="group rounded-lg border bg-card px-4 py-3" key={key} name="faq">
            <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
              {m[`landing.faq.${key}.question`]()}
              <ChevronDown
                aria-hidden="true"
                className="size-4 transition-transform group-open:rotate-180"
              />
            </summary>
            <p className="mt-2 text-muted-foreground text-sm">
              {m[`landing.faq.${key}.answer`]()}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
