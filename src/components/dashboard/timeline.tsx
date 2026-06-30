"use client";

import { useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTagFilter } from "@/hooks/use-tag-filter";
import type { Diary } from "@/types";

interface TimelineProps {
  todayDiary: Diary | null;
}

export default function Timeline({ todayDiary }: TimelineProps) {
  const router = useRouter();
  const { setSelectedTag } = useTagFilter();
  const scrollRef = useRef<HTMLDivElement>(null);

  const events = useMemo(() => {
    if (!todayDiary?.tags) return [];
    const list: Array<{ hour: number; minute: number; timeLabel: string; tagName: string; tagColor: string; tagId: string }> = [];
    for (const t of todayDiary.tags) {
      if (!t.time_label) continue;
      const parts = t.time_label.split(":");
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (isNaN(h)) continue;
      list.push({
        hour: h,
        minute: isNaN(m) ? 0 : m,
        timeLabel: t.time_label,
        tagName: t.tag?.name || "?",
        tagColor: t.tag?.color || "#3B82F6",
        tagId: t.tag_id,
      });
    }
    list.sort((a, b) => a.hour - b.hour || a.minute - b.minute);
    return list;
  }, [todayDiary]);

  const range = useMemo(() => {
    let start = 0, end = 23;
    if (todayDiary?.wake_time) {
      const h = parseInt(todayDiary.wake_time.split("T")[1]?.slice(0, 2), 10);
      if (!isNaN(h)) start = h;
    }
    if (todayDiary?.sleep_time) {
      const h = parseInt(todayDiary.sleep_time.split("T")[1]?.slice(0, 2), 10);
      if (!isNaN(h)) end = Math.min(h < start ? h + 24 : h, 23);
    }
    return { start, end };
  }, [todayDiary]);

  const currentHour = useMemo(() => {
    const h = new Date().getHours();
    if (h < range.start) return range.start;
    if (h > range.end) return range.end;
    return h;
  }, [range]);

  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current.querySelector(`[data-hour="${currentHour}"]`);
    if (el) el.scrollIntoView({ block: "start", behavior: "auto" });
  }, [currentHour]);

  if (!todayDiary) {
    return (
      <div className="bg-surface dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/50 p-6 text-center">
        <p className="text-sm text-gray-400 dark:text-slate-500 mb-3">今天还没有记录</p>
        <button onClick={() => router.push("/write")}
          className="px-5 py-2 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600">
          ✍️ 开始记录今天
        </button>
      </div>
    );
  }

  const hours: number[] = [];
  for (let h = range.start; h <= range.end; h++) hours.push(h);

  return (
    <div className="bg-surface dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/50">
      <div className="sticky top-0 z-10 px-4 pt-4 pb-2 bg-surface dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700/50">
        <h3 className="text-xs font-semibold text-gray-400 dark:text-slate-500">🕐 今天时间轴</h3>
      </div>

      <div ref={scrollRef} className="overflow-y-auto max-h-[600px] overscroll-contain [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="py-1 relative">
          {/* 连续连接线 */}
          <div className="absolute left-[61px] top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-slate-700" />

          {hours.map((h, hi) => {
            const isCurrent = h === currentHour;
            const hourEvents = events.filter(e => e.hour === h);

            return (
              <div key={h} data-hour={h} className="flex items-stretch min-h-[44px] animate-[tl-in_0.3s_ease-out_both]"
                style={{ animationDelay: `${hi * 30}ms` }}>
                {/* 左：小时 */}
                <div className="shrink-0 w-14 flex flex-col items-center justify-center">
                  <span className={`text-[11px] font-bold leading-none ${
                    isCurrent ? "text-blue-500" : "text-gray-400 dark:text-slate-500"
                  }`}>
                    {String(h).padStart(2, "0")}:00
                  </span>
                  {isCurrent && <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                </div>
                {/* 中：圆点（连续线之上） */}
                <div className="shrink-0 w-3 flex items-center justify-center">
                  {hourEvents.length > 0 ? (
                    hourEvents.map((ev, ei) => (
                      <div key={ei}
                        className="w-[10px] h-[10px] rounded-full shrink-0 z-10"
                        style={{ backgroundColor: ev.tagColor }} />
                    ))
                  ) : (
                    <div className="w-[10px] h-[10px] rounded-full shrink-0 z-10 border-2 border-dashed border-gray-300 dark:border-slate-600 bg-surface" />
                  )}
                </div>
                {/* 右：卡片（原样式） */}
                <div className="flex-1 min-w-0 flex items-center pr-4 pl-3">
                  {hourEvents.length > 0 ? (
                    <div className="w-full py-2">
                      {hourEvents.map((ev, ei) => (
                        <div key={`${ev.tagId}-${ei}`}
                          onClick={() => router.push("/write")}
                          className="bg-surface dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/50 px-3.5 py-2.5 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
                          <span
                            onClick={(e) => { e.stopPropagation(); setSelectedTag(ev.tagName); router.push("/write"); }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium cursor-pointer hover:opacity-80"
                            style={{ backgroundColor: ev.tagColor + "18", color: ev.tagColor }}>
                            #{ev.tagName}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <button onClick={() => router.push("/write")}
                      className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700 py-2 w-full max-w-[120px]
                        flex items-center justify-center
                        text-gray-300 dark:text-slate-500 hover:text-blue-400 hover:border-blue-300
                        transition-all duration-200 group">
                      <span className="text-lg font-light leading-none group-hover:scale-125 transition-transform">+</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
