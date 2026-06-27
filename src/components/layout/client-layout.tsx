"use client";

import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import TopNav from "@/components/layout/top-nav";
import BottomNav from "@/components/layout/bottom-nav";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <TopNav />
        <main className="flex-1 w-full pb-14 md:pb-0">
          {children}
        </main>
        <BottomNav />
      </AuthProvider>
    </ThemeProvider>
  );
}
