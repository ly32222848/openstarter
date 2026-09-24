import { Button } from "@openstarter/ui-web/components/button";
import { Skeleton } from "@openstarter/ui-web/components/skeleton";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useCallback, useState } from "react";

import { Drawer } from "@/components/drawer";
import { LocaleToggle } from "@/components/locale/locale-toggle";
import { ThemeToggleIcon } from "@/components/theme/theme-toggle-icon";
import { authClient } from "@/lib/auth-client";
import { BRAND_NAME } from "@/lib/branding";
import { m } from "@/paraglide/messages.js";

const NAV_LINKS = [
  { hash: "features", key: "landing.nav.features", to: "/" },
  { hash: undefined, key: "landing.nav.pricing", to: "/pricing" },
  { hash: "faq", key: "landing.nav.faq", to: "/" },
] as const;

function AuthCta() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Skeleton className="h-8 w-32" />;
  }
  if (session) {
    return (
      <Button asChild>
        <Link to="/dashboard">{m["landing.header.dashboard"]()}</Link>
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="ghost">
        <Link to="/login">{m["landing.header.sign_in"]()}</Link>
      </Button>
      <Button asChild>
        <Link to="/login">{m["landing.header.sign_up"]()}</Link>
      </Button>
    </div>
  );
}

export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link className="font-semibold" to="/">
          {BRAND_NAME}
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              className="text-muted-foreground text-sm hover:text-foreground"
              hash={link.hash}
              key={link.key}
              to={link.to}
            >
              {m[link.key]()}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <LocaleToggle />
          <ThemeToggleIcon />
          <AuthCta />
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <LocaleToggle />
          <ThemeToggleIcon />
          <Button
            aria-expanded={open}
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Menu aria-hidden="true" />
          </Button>
        </div>
      </div>

      <Drawer className="gap-4 p-4" label="Menu" onClose={close} open={open} side="right">
        <div className="flex items-center justify-between">
          <span className="font-semibold">{BRAND_NAME}</span>
          <Button aria-label="Close menu" onClick={close} size="icon" type="button" variant="ghost">
            <X aria-hidden="true" />
          </Button>
        </div>
        <nav className="flex flex-col gap-3">
          {NAV_LINKS.map((link) => (
            <Link
              className="text-sm"
              hash={link.hash}
              key={link.key}
              onClick={close}
              to={link.to}
            >
              {m[link.key]()}
            </Link>
          ))}
        </nav>
        <AuthCta />
      </Drawer>
    </header>
  );
}
