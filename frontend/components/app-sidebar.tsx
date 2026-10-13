"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LayoutDashboard, LineChart, Target } from "lucide-react";
import { ConnectionBadge } from "@/components/connection-badge";
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
} from "@/components/ui/sidebar";

const items = [
  { title: "Overview", url: "/", icon: LayoutDashboard },
  { title: "Velocity", url: "/velocity", icon: LineChart },
  { title: "Strike Zone", url: "/strike-zone", icon: Target },
  { title: "Alerts", url: "/alerts", icon: Bell },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md gradient-accent shadow-glow">
            <span className="font-display text-base font-bold text-white">S</span>
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-display text-sm font-bold tracking-tight text-white">STATCAST</span>
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Live Analytics
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="px-2 py-2 group-data-[collapsible=icon]:hidden">
          <ConnectionBadge label="TOR" />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
