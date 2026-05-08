import type { Metadata } from "next";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Bell, Search, User } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Statcast — Live MLB Pitch Analytics",
  description:
    "Real-time MLB pitch tracking, velocity analytics and strike-zone intelligence.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground min-h-screen">
        <SidebarProvider>
          <div className="flex min-h-screen w-full">
            <AppSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md">
                <SidebarTrigger className="-ml-1" />
                <div className="hidden h-5 w-px bg-border md:block" />
                <div className="flex flex-1 items-center gap-2">
                  <div className="relative hidden w-full max-w-sm md:block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      placeholder="Search pitchers, games, plays…"
                      className="h-9 w-full rounded-md border border-border bg-secondary/40 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/40"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="hidden items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:inline-flex">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[oklch(0.7_0.18_145)]" />
                    Live
                  </span>
                  <button className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                    <Bell className="h-4 w-4" />
                  </button>
                  <button className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-secondary/40 text-foreground">
                    <User className="h-4 w-4" />
                  </button>
                </div>
              </header>
              <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
            </div>
          </div>
        </SidebarProvider>
      </body>
    </html>
  );
}
