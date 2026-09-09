// apps/web/src/components/app/app-sidebar.tsx
// Primary app sidebar built on the shared shadcn Sidebar primitives
// (@openstarter/ui-web/components/sidebar): collapsible to icons on desktop
// (state persisted in the sidebar_state cookie, Cmd/Ctrl+B toggles) and a
// slide-in Sheet on mobile — replacing the old hand-rolled Sidebar + Drawer.

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openstarter/ui-web/components/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@openstarter/ui-web/components/sidebar";
import { Skeleton } from "@openstarter/ui-web/components/skeleton";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, User, UserCog } from "lucide-react";
import { useState } from "react";

import { ManageAccountDialog } from "@/components/app/manage-account-dialog";
import { APP_NAV_ITEMS } from "@/components/app/app-nav";
import { ThemeMenuItems } from "@/components/theme/theme-menu-items";
import { authClient } from "@/lib/auth-client";
import { BRAND_NAME } from "@/lib/branding";

export function AppSidebar() {
  const navigate = useNavigate();
  const [manageOpen, setManageOpen] = useState(false);
  const { data: session, isPending } = authClient.useSession();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
              <Link to="/dashboard">
                <span className="font-semibold text-base">{BRAND_NAME}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {APP_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link to={item.to}>
                        <Icon aria-hidden="true" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {isPending ? (
              <Skeleton className="h-10 w-full" />
            ) : session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <User aria-hidden="true" className="size-4" />
                    </span>
                    <span className="flex min-w-0 flex-col items-start">
                      <span className="truncate font-medium text-sm">{session.user.name}</span>
                      <span className="truncate text-muted-foreground text-xs">
                        {session.user.email}
                      </span>
                    </span>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 bg-card" side="top">
                  <DropdownMenuItem onClick={() => setManageOpen(true)}>
                    <UserCog aria-hidden="true" className="size-4" />
                    Manage Account
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Theme</DropdownMenuLabel>
                    <ThemeMenuItems />
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      authClient.signOut({
                        fetchOptions: {
                          onSuccess: () => {
                            navigate({ to: "/" });
                          },
                        },
                      });
                    }}
                    variant="destructive"
                  >
                    <LogOut aria-hidden="true" className="size-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
                <ManageAccountDialog onOpenChange={setManageOpen} open={manageOpen} />
              </DropdownMenu>
            ) : null}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
