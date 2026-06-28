"use client";

import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import { TagFilterProvider, useTagFilter } from "@/hooks/use-tag-filter";
import TopNav from "@/components/layout/top-nav";
import BottomNav from "@/components/layout/bottom-nav";

function FilterBar() {
  const { selectedTag, clearFilter } = useTagFilter();
  if (!selectedTag) return null;
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-blue-50/60 dark:bg-blue-900/15 border-b border-blue-100 dark:border-blue-800/30 text-xs">
      <span className="text-gray-500 dark:text-slate-400">筛选：</span>
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-800/40 text-blue-700 dark:text-blue-300 font-medium">
        #{selectedTag}
      </span>
      <button onClick={clearFilter}
        className="ml-1 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors">
        ✕ 清除
      </button>
    </div>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <TagFilterProvider>
          <TopNav />
          <FilterBar />
          <main className="flex-1 w-full pb-14 md:pb-0">
            {children}
          </main>
          <BottomNav />
        </TagFilterProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
