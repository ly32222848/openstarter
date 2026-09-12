// apps/web/src/components/app/app-shell.tsx
// Standard SaaS app shell: collapsible sidebar + sticky content header.
// Wraps the shadcn SidebarProvider; the collapsed state is persisted in the
// sidebar_state cookie so hydration restores the last choice.

import { SidebarInset, SidebarProvider } from "@openstarter/ui-web/components/sidebar";
import { Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AppHeader } from "@/components/app/app-header";
import { AppSidebar } from "@/components/app/app-sidebar";

const SIDEBAR_COOKIE_NAME = "sidebar_state";

/** Reads the persisted sidebar state; defaults to expanded when unset. */
export function getInitialSidebarOpen(): boolean {
  if (typeof document === "undefined") {
    return true;
  }
  return !document.cookie
    .split("; ")
    .some((cookie) => cookie.startsWith(`${SIDEBAR_COOKIE_NAME}=false`));
}

export function AppShell({ children }: { children?: ReactNode }) {
  return (
    <SidebarProvider defaultOpen={getInitialSidebarOpen()}>
      <AppSidebar />
      <SidebarInset>
        <AppHeader>{children}</AppHeader>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
