"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const navItems = [
  { label: "写日记", href: "/write", icon: "edit" },
  { label: "日历", href: "/calendar", icon: "calendar" },
  { label: "图表", href: "/charts", icon: "chart" },
  { label: "设置", href: "/settings", icon: "settings" },
];

function Icon({ type, active }: { type: string; active: boolean }) {
  const c = active ? "#3b82f6" : "currentColor";
  const fill = active ? "url(#grad)" : "none";
  const svg = (d: React.ReactNode) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <defs><linearGradient id="grad"><stop stopColor="#3b82f6"/></linearGradient></defs>
      {active ? <g stroke="none" fill={c}>{d}</g> : d}
    </svg>
  );
  switch (type) {
    case "edit": return svg(<><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></>);
    case "calendar": return svg(<><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>);
    case "chart": return svg(<><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 4-6"/></>);
    case "tag": return svg(<><path d="M12 2H2v10l9.17 9.17a2 2 0 0 0 2.83 0l7-7a2 2 0 0 0 0-2.83L12 2Z"/><path d="M7 7h.01"/></>);
    case "settings": return svg(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>);
    default: return null;
  }
}

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 z-10 flex items-center justify-around h-14">
      {navItems.map((item) => {
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-md transition-colors ${isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-slate-400"}`}>
            <Icon type={item.icon} active={isActive} />
            <span className="text-[10px] leading-none">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
