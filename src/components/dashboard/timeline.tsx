"use client";

import { useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTagFilter } from "@/hooks/use-tag-filter";
import type { Diary } from "@/types";

/* ================================================================
   24 小时时间轴

   从起床到入睡的时间范围，以当前小时为初始可见位置。
   左侧：小时标记（00:00 ~ 23:00）
   右侧：有事件 → 卡片展示，无事件 → 虚线加号框
   ================================================================ */

interface HourEvent {
  hour: number;
  minute: number;
  timeLabel: string;
  tagName: string;
  tagColor: string;
  tagId: string;
}

interface HourSlot {
  hour: number;
  events: HourEvent[];
}

/** 从日记标签中提取时间事件，按小时分组 */
function buildHourSlots(diary: Diary | null): HourSlot[] {
  if (!diary?.tags) return [];

  const eventsByHour = new Map<number, HourEvent[]>();

  for (const t of diary.tags) {
    if (!t.time_label) continue;
    const parts = t.time_label.split(":");
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h)) continue;

    if (!eventsByHour.has(h)) eventsByHour.set(h, []);
    eventsByHour.get(h)!.push({
      hour: h,
      minute: isNaN(m) ? 0 : m,
      timeLabel: t.time_label,
      tagName: t.tag?.name || "?",
      tagColor: t.tag?.color || "#3B82F6",
      tagId: t.tag_id,
    });
  }

  // 有事件的小时，按分钟排序
  for (const [, events] of eventsByHour) {
    events.sort((a, b) => a.minute - b.minute);
  }

  // 确定时间范围：起床~入睡，如果没有则 0~23
  let startHour = 0;
  let endHour = 23;
  if (diary.wake_time) {
    const h = parseInt(diary.wake_time.split("T")[1]?.slice(0, 2), 10);
    if (!isNaN(h)) startHour = h;
  }
  if (diary.sleep_time) {
    const h = parseInt(diary.sleep_time.split("T")[1]?.slice(0, 2), 10);
    if (!isNaN(h)) {
      // 跨天（入睡在凌晨）
      endHour = h < startHour ? h + 24 : h;
    }
  }

  // 如果入睡在凌晨（跨天），加 24 标记
  // 为了让 Timeline 显示 0~23 内的内容，如果 endHour > 23 则折回
  const slots: HourSlot[] = [];
  // 限制显示范围：startHour ~ min(endHour, 23)
  const displayEnd = Math.min(endHour, 23);
  for (let h = startHour; h <= displayEnd; h++) {
    slots.push({
      hour: h,
      events: eventsByHour.get(h) || [],
    });
  }
  return slots;
}

interface TimelineProps {
  todayDiary: Diary | null;
}

export default function Timeline({ todayDiary }: TimelineProps) {
  const router = useRouter();
  const { setSelectedTag } = useTagFilter();
  const scrollRef = useRef<HTMLDivElement>(null);

  const slots = useMemo(() => buildHourSlots(todayDiary), [todayDiary]);

  // 当前小时
  const currentHour = useMemo(() => {
    const h = new Date().getHours();
    // 如果当前小时在时间范围外，用 startHour
    if (slots.length > 0) {
      const first = slots[0].hour;
      const last = slots[slots.length - 1].hour;
      if (h < first) return first;
      if (h > last) return last;
    }
    return h;
  }, [slots]);

  // 挂载后滚动到当前小时
  useEffect(() => {
    if (!scrollRef.current || slots.length === 0) return;
    const el = scrollRef.current.querySelector(`[data-hour="${currentHour}"]`);
    if (el) {
      el.scrollIntoView({ block: "start", behavior: "auto" });
    }
  }, [currentHour, slots.length]);

  // 点击空白加号 → 跳转写日记
  const handleAdd = useCallback((hour: number) => {
    router.push("/write");
  }, [router]);

  // 没有日记也没有事件 → 提示
  if (!todayDiary) {
    return (
      <div className="bg-surface dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/50 p-6 text-center">
        <p className="text-sm text-gray-400 dark:text-slate-500 mb-3">今天还没有记录</p>
        <button
          onClick={() => router.push("/write")}
          className="px-5 py-2 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600 transition-colors"
        >
          ✍️ 开始记录今天
        </button>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="bg-surface dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/50 p-6 text-center">
        <p className="text-sm text-gray-400 dark:text-slate-500">还没有带时间的事件</p>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
          试试在日记里写 "10点#起床 14点#学习"
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/50">
      <div className="sticky top-0 z-10 px-4 pt-4 pb-2 bg-surface dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700/50">
        <h3 className="text-xs font-semibold text-gray-400 dark:text-slate-500">🕐 今天时间轴</h3>
      </div>

      <div ref={scrollRef} className="overflow-y-auto max-h-[600px] overscroll-contain">
        {slots.map((slot, si) => {
          const isCurrent = slot.hour === currentHour;
          const isPast = slot.hour < currentHour;

          return (
            <div
              key={slot.hour}
              data-hour={slot.hour}
              className={`flex border-b border-gray-50 dark:border-slate-700/30 last:border-b-0
                animate-[tl-in_0.3s_ease-out_both]`}
              style={{ animationDelay: `${si * 30}ms` }}
            >
              {/* 左侧：小时标记 */}
              <div className="shrink-0 w-16 pt-4 pb-3 flex flex-col items-center">
                <span className={`text-xs font-bold leading-none ${
                  isCurrent
                    ? "text-blue-500 dark:text-blue-400"
                    : isPast
                      ? "text-gray-400 dark:text-slate-500"
                      : "text-gray-500 dark:text-slate-400"
                }`}>
                  {String(slot.hour).padStart(2, "0")}:00
                </span>
                {isCurrent && (
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                )}
              </div>

              {/* 右侧：事件卡片 / 加号按钮 */}
              <div className="flex-1 min-w-0 py-3 pr-4">
                {slot.events.length > 0 ? (
                  <div className="space-y-2">
                    {slot.events.map((ev, ei) => (
                      <div
                        key={`${ev.tagId}-${ev.timeLabel}-${ei}`}
                        className="rounded-xl px-3.5 py-2.5 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                        style={{
                          backgroundColor: ev.tagColor + "10",
                          borderLeft: `3px solid ${ev.tagColor}`,
                        }}
                        onClick={() => router.push("/write")}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-500">
                            {ev.timeLabel}
                          </span>
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium cursor-pointer hover:opacity-80"
                            style={{ backgroundColor: ev.tagColor + "20", color: ev.tagColor }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTag(ev.tagName);
                              router.push("/write");
                            }}
                          >
                            #{ev.tagName}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <button
                    onClick={() => handleAdd(slot.hour)}
                    className="w-full h-12 rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-600
                      flex items-center justify-center gap-2
                      text-gray-300 dark:text-slate-500 hover:text-blue-400 dark:hover:text-blue-300
                      hover:border-blue-300 dark:hover:border-blue-500
                      transition-all duration-200 group"
                  >
                    <span className="text-lg font-light leading-none group-hover:scale-125 transition-transform">+</span>
                    <span className="text-xs">{String(slot.hour).padStart(2, "0")}:00</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
