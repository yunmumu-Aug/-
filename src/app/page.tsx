"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth");
  }, [user, authLoading, router]);

  if (authLoading || !user) return null;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 pt-0 pb-3 sm:py-6">
      <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-20">
        ⏳ Dashboard 即将到来……
      </p>
    </div>
  );
}
