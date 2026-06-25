"use client";

import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import Sidebar from "@/components/layout/sidebar";
import BottomNav from "@/components/layout/bottom-nav";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="flex min-h-full w-full">
          <Sidebar />
          <main className="flex-1 min-w-0 md:ml-55 pb-14 md:pb-0">
            {children}
          </main>
        </div>
        <BottomNav />
      </AuthProvider>
    </ThemeProvider>
  );
}
