"use client";

import { AuthProvider } from "@/hooks/use-auth";
import Sidebar from "@/components/layout/sidebar";
import BottomNav from "@/components/layout/bottom-nav";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex min-h-full w-full overflow-x-hidden">
        <Sidebar />
        <main className="flex-1 min-w-0 md:ml-55 pb-14 md:pb-0">
          {children}
        </main>
      </div>
      <BottomNav />
    </AuthProvider>
  );
}
