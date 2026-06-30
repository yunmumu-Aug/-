"use client";

import { useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTagFilter } from "@/hooks/use-tag-filter";
import type { Diary } from "@/types";

/**
 * 24 小时时间轴
 *
 * 从起床小时到入睡小时，以当前小时为初始可见位置。
 * 每小时一行，左侧 HH:00 标记，右侧使用原样式（圆点+连接线+白色卡片）。
 */

interface TimelineProps {
  todayDiary: Diary | null;
}

export default function Timeline({ todayDiary }: TimelineProps) {
  const router = useRouter();
  const { setSelectedTag } = useTagFilter();
  const scrollRef = useRef<HTMLDivElement>(null);

  // 从日记标签提取事件
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

  // 时间范围（起床~入睡）
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

  // 构建小时列表
  const hours: number[] = [];
  for (let h = range.start; h <= range.end; h++) hours.push(h);

  return (
    <div className="bg-surface dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/50">
      <div className="sticky top-0 z-10 px-4 pt-4 pb-2 bg-surface dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700/50">
        <h3 className="text-xs font-semibold text-gray-400 dark:text-slate-500">🕐 今天时间轴</h3>
      </div>

      <div ref={scrollRef} className="overflow-y-auto max-h-[600px] overscroll-contain">
        <div className="py-2">
          {hours.map((h, hi) => {
            const isCurrent = h === currentHour;
            const hourEvents = events.filter(e => e.hour === h);

            return (
              <div key={h} data-hour={h} className="px-4 animate-[tl-in_0.3s_ease-out_both]"
                style={{ animationDelay: `${hi * 30}ms` }}>
                {/* 小时头 */}
                <div className="flex items-center gap-2 py-2">
                  <span className={`text-[11px] font-bold leading-none ${
                    isCurrent ? "text-blue-500" : "text-gray-400 dark:text-slate-500"
                  }`}>
                    {String(h).padStart(2, "0")}:00
                  </span>
                  {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                </div>

                {/* 事件卡片（原样式） */}
                {hourEvents.length > 0 ? (
                  <div className="space-y-0 pb-1">
                    {hourEvents.map((ev, ei) => {
                      const isLastHour = hi === hours.length - 1;
                      const isLastEvent = ei === hourEvents.length - 1;
                      const isLast = isLastHour && isLastEvent;

                      return (
                        <div key={`${ev.tagId}-${ev.timeLabel}-${ei}`}
                          className="flex items-stretch gap-3 cursor-pointer group"
                          onClick={() => router.push("/write")}>
                          {/* 原样式：圆点 + 连接线 */}
                          <div className="flex flex-col items-center shrink-0" style={{ width: 20 }}>
                            <div className="w-2 h-2 rounded-full mt-[18px] shrink-0" style={{ backgroundColor: ev.tagColor }} />
                            {!isLast && <div className="w-0.5 flex-1 mt-0.5 rounded-full" style={{ backgroundColor: "#dce5f2" }} />}
                          </div>
                          {/* 原样式：白色卡片 */}
                          <div className="flex-1 pb-2.5 min-w-0">
                            <div className="bg-surface dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/50 p-3.5 shadow-sm group-hover:shadow-md transition-shadow">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-500">{ev.timeLabel}</span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium cursor-pointer hover:opacity-80"
                                  style={{ backgroundColor: ev.tagColor + "18", color: ev.tagColor }}
                                  onClick={(e) => { e.stopPropagation(); setSelectedTag(ev.tagName); router.push("/write"); }}>
                                  #{ev.tagName}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* 无事件：虚框加号 */
                  <div className="flex items-stretch gap-3 pb-2.5">
                    <div className="flex flex-col items-center shrink-0" style={{ width: 20 }}>
                      <div className="w-2 h-2 rounded-full mt-[18px] shrink-0 border-2 border-dashed border-gray-300 dark:border-slate-600 bg-surface" />
                      {hi < hours.length - 1 && <div className="w-0.5 flex-1 mt-0.5 rounded-full" style={{ backgroundColor: "#dce5f2" }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <button onClick={() => router.push("/write")}
                        className="w-full rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700 p-3.5
                          flex items-center justify-center gap-2
                          text-gray-300 dark:text-slate-500 hover:text-blue-400 hover:border-blue-300
                          transition-all duration-200 group">
                        <span className="text-lg font-light leading-none group-hover:scale-125 transition-transform">+</span>
                        <span className="text-xs">{String(h).padStart(2, "0")}:00</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
