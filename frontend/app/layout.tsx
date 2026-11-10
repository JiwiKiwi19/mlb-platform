import type { Metadata } from "next";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ConnectionBadge } from "@/components/connection-badge";
import { AlertsBell } from "@/components/live-alerts";
import { LiveAlertsProvider } from "@/components/providers/live-alerts-provider";
import { LivePitchesProvider } from "@/components/providers/live-pitches-provider";
import { fetchRecentAlerts, fetchRecentPitches } from "@/lib/supabase/server";
import "./globals.css";

// The layout persists across client navigations, so the realtime subscription
// and pitch buffer it hosts survive page changes. Always render fresh data.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Statcast — Live MLB Pitch Analytics",
  description: "Real-time MLB pitch tracking, velocity analytics and strike-zone intelligence.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [initialPitches, initialAlerts] = await Promise.all([fetchRecentPitches(), fetchRecentAlerts()]);

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground">
        <LivePitchesProvider initialPitches={initialPitches}>
          <LiveAlertsProvider initialAlerts={initialAlerts}>
            <SidebarProvider>
              <div className="flex min-h-screen w-full">
                <AppSidebar />
                <div className="flex min-w-0 flex-1 flex-col">
                  <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md">
                    <SidebarTrigger className="-ml-1" />
                    <div className="hidden h-5 w-px bg-border md:block" />
                    <div className="flex-1" />
                    <div className="flex items-center gap-2">
                      <ConnectionBadge className="hidden rounded-md border border-border bg-secondary/40 px-2.5 py-1 sm:inline-flex" />
                      <AlertsBell />
                    </div>
                  </header>
                  <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
                </div>
              </div>
            </SidebarProvider>
          </LiveAlertsProvider>
        </LivePitchesProvider>
      </body>
    </html>
  );
}
