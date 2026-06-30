"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";

const navItems = [
  { label: "首页", href: "/", icon: "home" },
  { label: "写日记", href: "/write", icon: "edit" },
  { label: "日历", href: "/calendar", icon: "calendar" },
  { label: "图表", href: "/charts", icon: "chart" },
  { label: "标签", href: "/tags", icon: "tag" },
  { label: "设置", href: "/settings", icon: "settings" },
];

function NavIcon({ type, active }: { type: string; active?: boolean }) {
  const c = active ? "#3b82f6" : "currentColor";
  const p = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: c,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (type === "home") return <svg {...p}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
  if (type === "edit") return <svg {...p}><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>;
  if (type === "calendar") return <svg {...p}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
  if (type === "chart") return <svg {...p}><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 4-6"/></svg>;
  if (type === "chart") return <svg {...p}><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 4-6"/></svg>;
  if (type === "tag") return <svg {...p}><path d="M12 2H2v10l9.17 9.17a2 2 0 0 0 2.83 0l7-7a2 2 0 0 0 0-2.83L12 2Z"/><path d="M7 7h.01"/></svg>;
  if (type === "settings") return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
  return null;
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();

  return (
    <aside className="hidden md:flex md:flex-col md:w-56 md:fixed md:inset-y-0 md:border-r md:border-gray-200 md:dark:border-slate-700 md:bg-surface dark:md:bg-slate-900 md:z-30">
      {/* Logo */}
      <Link href="/" className="flex items-center h-16 px-5 border-b border-gray-200 dark:border-slate-700 shrink-0">
        <span className="text-xl font-bold text-gray-800 dark:text-slate-100">⏳ 时光轴</span>
      </Link>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                  : "text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-200"
              }`}
            >
              <NavIcon type={item.icon} active={isActive} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom area */}
      <div className="px-4 py-4 border-t border-gray-200 dark:border-slate-700 space-y-3 shrink-0">
        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
        >
          <span className="text-lg">{theme === "dark" ? "☀️" : "🌙"}</span>
          <span>{theme === "dark" ? "浅色模式" : "深色模式"}</span>
        </button>

        {/* User & Sign out */}
        {user && (
          <button
            onClick={signOut}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-red-500 transition-colors"
          >
            <span>🚪</span>
            <span>退出登录</span>
          </button>
        )}
      </div>
    </aside>
  );
}
