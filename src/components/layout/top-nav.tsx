"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";

function getInitials(name: string): string {
  return name.charAt(0).toUpperCase();
}

const navItems = [
  { label: "写日记", href: "/", icon: "✍️" },
  { label: "日历", href: "/calendar", icon: "📅" },
  { label: "图表", href: "/charts", icon: "📊" },
  { label: "标签", href: "/tags", icon: "🏷️" },
  { label: "设置", href: "/settings", icon: "⚙️" },
];

export default function TopNav() {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();
  const { theme, toggle } = useTheme();

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "用户";
  const initials = getInitials(displayName);

  return (
    <header className="hidden md:flex items-center justify-center h-16 px-6 bg-surface dark:bg-slate-900 shadow-sm border-b border-gray-200 dark:border-slate-700 sticky top-0 z-30">
      <div className="flex items-center gap-8 w-full max-w-5xl">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-xl font-bold text-gray-800 dark:text-slate-100">
            ⏳ 时光轴
          </span>
        </Link>

        {/* Nav tabs */}
        <nav className="flex items-center gap-0.5 flex-1 justify-end">
          {navItems.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                    : "text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-200"
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-sm border border-gray-300 dark:border-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          title={theme === "dark" ? "切换日间模式" : "切换夜间模式"}
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>

        {/* User */}
        {user && (
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-semibold shrink-0">
              {initials}
            </div>
            <span className="text-xs text-gray-400 dark:text-slate-500 hidden lg:block max-w-[80px] truncate">
              {displayName}
            </span>
            <button
              onClick={signOut}
              className="text-xs text-gray-400 dark:text-slate-500 hover:text-red-500 transition-colors"
            >
              退出
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
