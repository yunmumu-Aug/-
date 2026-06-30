"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useTagFilter } from "@/hooks/use-tag-filter";
import { useDiary } from "@/hooks/use-diary";
import { supabase } from "@/lib/supabase";
import {
  format as df, subDays, subYears, isSameDay, parseISO,
} from "date-fns";
import { zhCN } from "date-fns/locale";
import type { Diary } from "@/types";

/* ================================================================
   Helpers
   ================================================================ */

function getTodayStr() {
  return df(new Date(), "yyyy-MM-dd");
}

function calcAwakeHours(wakeTime: string | null): { h: number; m: number; total: string } {
  if (!wakeTime) return { h: 0, m: 0, total: "0小时0分钟" };
  const now = new Date();
  const wake = new Date(wakeTime);
  const diffMs = now.getTime() - wake.getTime();
  const totalMin = Math.max(0, Math.floor(diffMs / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return { h, m, total: `${h}小时${m}分钟` };
}

function calcSleepHours(wakeTime: string | null, sleepTime: string | null): { hours: number; label: string } | null {
  if (!wakeTime || !sleepTime) return null;
  const w = new Date(wakeTime);
  const s = new Date(sleepTime);
  let diffMs = w.getTime() - s.getTime();
  if (diffMs <= 0) diffMs += 24 * 60 * 60 * 1000;
  const hours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
  const hh = Math.floor(hours);
  const mm = Math.round((hours % 1) * 60);
  return { hours, label: hours >= 1 ? `${hh}时${mm}分` : `${mm}分` };
}

function calcCurrentStreak(diaryDates: Set<string>): number {
  let streak = 0;
  for (let i = 0; ; i++) {
    const d = df(subDays(new Date(), i), "yyyy-MM-dd");
    if (diaryDates.has(d)) {
      streak++;
    } else if (i > 0) {
      break;
    } else {
      // today doesn't have a diary yet, streak from yesterday
      continue;
    }
  }
  return streak;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 9) return "早上好";
  if (h < 12) return "上午好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const p = iso.includes("T") ? iso.split("T")[1]?.slice(0, 5) : iso;
  return p || "";
}

/* ================================================================
   Timeline Event type
   ================================================================ */

interface TimelineEvent {
  time: string;
  label: string;
  color: string;
  timeLabel: string;
  diaryId: string;
}

/* ================================================================
   Sub-components
   ================================================================ */

/** Header — sticky top bar inside the page content */
function DashboardHeader({ displayName, dateStr }: { displayName: string; dateStr: string }) {
  return (
    <div className="sticky top-0 z-20 px-4 sm:px-6 md:px-0 py-3
      bg-surface dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-800 dark:text-slate-100">
            {greeting()}，{displayName}
          </h1>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{dateStr}</p>
        </div>
        <button
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors shadow-sm"
          title="搜索"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/** HeroCard — 时间进度卡 */
function HeroCard({
  awakeLabel,
  streak,
  eventCount,
  lastYearDiary,
}: {
  awakeLabel: string;
  streak: number;
  eventCount: number;
  lastYearDiary: Diary | null;
}) {
  return (
    <div className="relative overflow-hidden rounded-[26px] shadow-[0_16px_36px_rgba(215,220,235,0.35)] dark:shadow-[0_16px_36px_rgba(0,0,0,0.3)]"
      style={{ backgroundColor: "#edf3fd" }}>
      {/* Subtle watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <span className="text-[120px] font-black text-blue-600/5 dark:text-blue-400/5">⏳</span>
      </div>
      <div className="relative z-10 px-5 py-5">
        {/* Time progress — visual center */}
        <div className="text-center mb-3">
          <div className="text-[32px] font-extrabold tracking-tight text-blue-700 dark:text-blue-300 leading-none">
            {awakeLabel}
          </div>
          <div className="text-[11px] text-blue-500/70 dark:text-blue-300/60 mt-1 font-medium">今日已过时间</div>
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-center gap-6 text-xs">
          <div className="text-center">
            <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">🌱 {streak}</div>
            <div className="text-[10px] text-blue-500/60 dark:text-blue-300/50 mt-0.5">连续天数</div>
          </div>
          <div className="w-px h-8 bg-blue-200/50 dark:bg-blue-400/20" />
          <div className="text-center">
            <div className="text-base font-bold text-indigo-600 dark:text-indigo-400">📝 {eventCount}</div>
            <div className="text-[10px] text-blue-500/60 dark:text-blue-300/50 mt-0.5">今日事件</div>
          </div>
          {lastYearDiary && (
            <>
              <div className="w-px h-8 bg-blue-200/50 dark:bg-blue-400/20" />
              <div className="text-center max-w-[100px]">
                <div className="text-[10px] font-medium text-amber-600 dark:text-amber-400 truncate">
                  📖 {lastYearDiary.date.slice(5)}
                </div>
                <div className="text-[9px] text-blue-500/50 dark:text-blue-300/40 mt-0.5 truncate">
                  {lastYearDiary.content?.slice(0, 12) || "有记录"}…
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** QuickEntry — 快速记录入口卡 */
function QuickEntry({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl bg-surface dark:bg-slate-800 border border-gray-200 dark:border-slate-700
        hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 text-left">
      <span className="text-2xl leading-none">😊</span>
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-slate-200">今天发生了什么？</p>
        <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">点击开始记录……</p>
      </div>
      <span className="ml-auto text-lg text-gray-300 dark:text-slate-600">✏️</span>
    </button>
  );
}

/** Timeline — 当日时间轴 */
function TimelineBlock({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return null;
  return (
    <div className="space-y-0">
      {events.map((ev, i) => (
        <div key={`${ev.diaryId}-${ev.timeLabel}-${i}`} className="flex items-stretch gap-3 animate-[tl-in_0.3s_ease-out_both]"
          style={{ animationDelay: `${i * 60}ms`, transformOrigin: "top" }}>
          {/* Time dot + line */}
          <div className="flex flex-col items-center shrink-0" style={{ width: 20 }}>
            <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: ev.color }} />
            {i < events.length - 1 && <div className="w-0.5 flex-1 mt-0.5 rounded-full" style={{ backgroundColor: "#dce5f2" }} />}
          </div>
          {/* Content card */}
          <div className="flex-1 mb-2.5">
            <div className="bg-surface dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/50 p-3.5 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-500">{ev.time}</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ backgroundColor: ev.color + "18", color: ev.color }}>
                  {ev.label}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** TodaySummary — 今日总结底部栏 */
function TodaySummary({
  eventCount,
  tagCount,
  sleepLabel,
  wordCount,
}: {
  eventCount: number;
  tagCount: number;
  sleepLabel: string | null;
  wordCount: number;
}) {
  return (
    <div className="fixed bottom-14 md:bottom-0 left-0 right-0 z-20 px-4 pb-3 pt-0 pointer-events-none">
      <div className="max-w-5xl mx-auto pointer-events-auto">
        <div
          className="rounded-2xl px-5 py-3.5 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.2)]
            flex items-center justify-between text-sm animate-[ts-up_0.4s_ease-out_both]"
          style={{ background: "linear-gradient(90deg, #edf9ea, #f6fbf5)" }}
        >
          <div className="flex items-center gap-1">
            <span className="text-base">🌱</span>
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">今日总结</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-emerald-600/80 dark:text-emerald-300/70">
            <span>{eventCount} 事件</span>
            <span>{tagCount} 标签</span>
            {sleepLabel && <span>🛌 {sleepLabel}</span>}
            <span>{wordCount} 字</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   Main Dashboard Page
   ================================================================ */

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { getDiary, getDiaries } = useDiary();
  const router = useRouter();
  const { selectedTag, setSelectedTag } = useTagFilter();

  const [todayDiary, setTodayDiary] = useState<Diary | null>(null);
  const [lastYearDiary, setLastYearDiary] = useState<Diary | null>(null);
  const [diaryDateSet, setDiaryDateSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");

  const todayStr = getTodayStr();

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth");
  }, [user, authLoading, router]);

  // Load user profile
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("id", user.id).single().then(({ data }) => {
      setDisplayName(data?.display_name || user.email?.split("@")[0] || "用户");
    });
  }, [user]);

  // Load main data
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        // Today's diary
        const today = await getDiary(todayStr);
        if (cancelled) return;
        setTodayDiary(today);

        // Last 60 days for streak
        const recent = await getDiaries(df(subDays(new Date(), 60), "yyyy-MM-dd"), todayStr);
        if (cancelled) return;
        setDiaryDateSet(new Set(recent.map(d => d.date)));

        // Last year today
        const lastYear = await getDiary(df(subYears(new Date(), 1), "yyyy-MM-dd"));
        if (cancelled) return;
        setLastYearDiary(lastYear);
      } catch (e) {
        console.error("Dashboard load error:", e);
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user, getDiary, getDiaries, todayStr]);

  // === Derived data ===

  const streak = useMemo(() => calcCurrentStreak(diaryDateSet), [diaryDateSet]);

  const awakeLabel = useMemo(() => {
    if (!todayDiary?.wake_time) return "--";
    return calcAwakeHours(todayDiary.wake_time).total;
  }, [todayDiary]);

  const timelineEvents = useMemo((): TimelineEvent[] => {
    if (!todayDiary?.tags) return [];
    const events: TimelineEvent[] = [];
    for (const t of todayDiary.tags) {
      if (t.time_label) {
        events.push({
          time: t.time_label,
          label: t.tag?.name || "?",
          color: t.tag?.color || "#3B82F6",
          timeLabel: t.time_label,
          diaryId: todayDiary.id,
        });
      }
    }
    events.sort((a, b) => a.timeLabel.localeCompare(b.timeLabel));
    return events;
  }, [todayDiary]);

  const eventCount = timelineEvents.length;
  const tagCount = todayDiary?.tags?.length || 0;
  const wordCount = todayDiary?.content?.length || 0;

  const sleepLabel = useMemo(() => {
    if (!todayDiary) return null;
    const s = calcSleepHours(todayDiary.wake_time, todayDiary.sleep_time);
    return s?.label || null;
  }, [todayDiary]);

  const hasNoData = !loading && !todayDiary && diaryDateSet.size === 0;

  if (authLoading || !user) return null;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 md:px-8">
      {/* ---- Smooth scroll for animations ---- */}
      <style>{`
        @keyframes tl-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ts-up {
          from { opacity: 0; transform: translateY(120%); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ---- Header ---- */}
      <DashboardHeader displayName={displayName} dateStr={df(new Date(), "yyyy年M月d日 EEEE", { locale: zhCN })} />

      {/* ---- Content area with padding for fixed summary ---- */}
      <div className="px-4 sm:px-6 md:px-0 pb-12">
        {/* Loading */}
        {loading && (
          <div className="text-center py-16">
            <div className="animate-spin w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full mx-auto" />
            <p className="text-xs text-gray-400 mt-2">加载中...</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && hasNoData && (
          <div className="text-center py-16">
            <p className="text-lg mb-1 text-gray-400">📭 还没有日记</p>
            <p className="text-sm text-gray-400 mb-4">记录今天的第一篇日记吧</p>
            <button onClick={() => router.push("/write")}
              className="px-5 py-2 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600 transition-colors shadow-sm">
              ✍️ 写第一篇日记
            </button>
          </div>
        )}

        {/* Dashboard */}
        {!loading && !hasNoData && (
          <div className="space-y-5">
            {/* Hero Card — fade in */}
            <div className="animate-[tl-in_0.4s_ease-out_both]">
              <HeroCard
                awakeLabel={awakeLabel}
                streak={streak}
                eventCount={eventCount}
                lastYearDiary={lastYearDiary}
              />
            </div>

            {/* Quick Entry */}
            {todayDiary === null && (
              <div className="animate-[tl-in_0.4s_ease-out_both]" style={{ animationDelay: "0.1s" }}>
                <QuickEntry onClick={() => router.push("/write")} />
              </div>
            )}

            {/* Timeline */}
            {timelineEvents.length > 0 && (
              <div className="animate-[tl-in_0.4s_ease-out_both]" style={{ animationDelay: "0.15s" }}>
                <div className="bg-surface dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/50 p-4">
                  <h3 className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                    🕐 今天时间线
                  </h3>
                  <TimelineBlock events={timelineEvents} />
                </div>
              </div>
            )}

            {/* Quick write prompt when diary exists but no events */}
            {todayDiary && timelineEvents.length === 0 && (
              <div className="animate-[tl-in_0.4s_ease-out_both]" style={{ animationDelay: "0.15s" }}>
                <button onClick={() => router.push("/write")}
                  className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl bg-surface dark:bg-slate-800 border border-dashed border-gray-200 dark:border-slate-700
                    hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 text-left">
                  <span className="text-2xl leading-none">📝</span>
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-slate-400">
                      今天还没有带时间的记录
                    </p>
                    <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">
                      试试在日记里写 "10点#起床 14点#学习"
                    </p>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---- Today Summary (fixed bottom) — only when there's data ---- */}
      {!loading && !hasNoData && (
        <TodaySummary
          eventCount={eventCount}
          tagCount={tagCount}
          sleepLabel={sleepLabel}
          wordCount={wordCount}
        />
      )}
    </div>
  );
}
