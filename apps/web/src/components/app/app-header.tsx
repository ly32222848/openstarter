// apps/web/src/components/app/app-header.tsx
// Sticky top header for the app shell: sidebar trigger (desktop collapse +
// mobile drawer), the current section title, and a right-hand action slot.

import { Separator } from "@openstarter/ui-web/components/separator";
import { SidebarTrigger } from "@openstarter/ui-web/components/sidebar";
import { useRouterState } from "@tanstack/react-router";

import { getAppNavTitle } from "@/components/app/app-nav";

export function AppHeader({ children }: { children?: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = getAppNavTitle(pathname);

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger aria-label="Toggle sidebar" />
      <Separator className="h-4" orientation="vertical" />
      {title ? <span className="truncate text-sm font-medium">{title}</span> : null}
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </header>
  );
}
