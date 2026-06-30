"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useTagFilter } from "@/hooks/use-tag-filter";
import { supabase } from "@/lib/supabase";
import {
  format as formatDateFn,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameDay,
  isToday,
} from "date-fns";
import { zhCN } from "date-fns/locale";
import type { Diary } from "@/types";

export default function CalendarPage() {
  const { user, getEncKey, loading: authLoading } = useAuth();
  const router = useRouter();

  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [diaryDates, setDiaryDates] = useState<Map<string, Diary>>(new Map());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [previewDiary, setPreviewDiary] = useState<Diary | null>(null);
  const [bottomMonth, setBottomMonth] = useState(new Date().getMonth());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setSelectedTag } = useTagFilter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentMonthRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth");
  }, [user, authLoading, router]);

  const fetchYearDiaries = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const start = `${currentYear}-01-01`;
    const end = `${currentYear}-12-31`;
    try {
      const { data } = await supabase
        .from("diaries")
        .select("*, tags:diary_tags(id, tag_id, time_label, position, tag:tags(id, name, color))")
        .eq("user_id", user.id)
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: true });
      const map = new Map<string, Diary>();
      (data || []).forEach((d) => map.set(d.date, d));
      setDiaryDates(map);
      setError(null);
    } catch (e) {
      console.error(e);
      setError("加载日历数据失败");
    }
    setLoading(false);
  }, [currentYear, user?.id, getEncKey]);

  useEffect(() => { fetchYearDiaries(); }, [fetchYearDiaries]);

  // 数据加载完成后自动选中今天的日记
  useEffect(() => {
    if (!loading && diaryDates.size > 0) {
      const today = formatDateFn(new Date(), "yyyy-MM-dd");
      if (diaryDates.has(today)) {
        setSelectedDate(new Date());
        setPreviewDiary(diaryDates.get(today) || null);
      }
    }
  }, [loading, diaryDates]);

  // 滚动到当前月份（居中）
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollRef.current && currentMonthRef.current) {
        const container = scrollRef.current;
        const element = currentMonthRef.current;
        const containerRect = container.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const offset = elementRect.left - containerRect.left - (containerRect.width - elementRect.width) / 2;
        container.scrollLeft += offset;
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [currentYear]);

  function handleDateClick(date: Date) {
    const key = formatDateFn(date, "yyyy-MM-dd");
    setSelectedDate(date);
    setPreviewDiary(diaryDates.get(key) || null);
    setBottomMonth(date.getMonth());
  }

  // 生成12个月的热力图网格（统一6行，不足补空）
  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, mi) => {
      const ms = new Date(currentYear, mi, 1);
      const me = new Date(currentYear, mi + 1, 0);
      const cs = startOfWeek(ms, { weekStartsOn: 1 });
      const ce = endOfWeek(me, { weekStartsOn: 1 });
      const rows: Date[][] = [];
      let cur = cs;
      while (cur <= ce) {
        const w: Date[] = [];
        for (let i = 0; i < 7; i++) { w.push(cur); cur = addDays(cur, 1); }
        rows.push(w);
      }
      // 补足到6行，保证月份标签齐平
      while (rows.length < 6) {
        const empty: Date[] = [];
        for (let i = 0; i < 7; i++) { empty.push(new Date(NaN)); }
        rows.push(empty);
      }
      return { monthIndex: mi, rows, daysInMonth: me.getDate() };
    });
  }, [currentYear]);

  const diaryCount = diaryDates.size;
  const weekDays = ["一", "二", "三", "四", "五", "六", "日"];
  const today = new Date();
  const nowYear = today.getFullYear();
  const nowMonth = today.getMonth();

  // 底部大月历网格
  const bottomMonthGrid = useMemo(() => {
    const ms = new Date(currentYear, bottomMonth, 1);
    const me = new Date(currentYear, bottomMonth + 1, 0);
    const cs = startOfWeek(ms, { weekStartsOn: 1 });
    const ce = endOfWeek(me, { weekStartsOn: 1 });
    const rows: Date[][] = [];
    let cur = cs;
    while (cur <= ce) {
      const w: Date[] = [];
      for (let i = 0; i < 7; i++) { w.push(cur); cur = addDays(cur, 1); }
      rows.push(w);
    }
    return rows;
  }, [currentYear, bottomMonth]);

  // 当前选中日期所在的那一周（手机端只显示这一行）
  const currentWeekRows = useMemo(() => {
    if (!selectedDate) return [bottomMonthGrid[0]];
    const week = bottomMonthGrid.filter(week =>
      week.some(d => !isNaN(d.getTime()) && isSameDay(d, selectedDate))
    );
    return week.length > 0 ? week : [bottomMonthGrid[0]];
  }, [bottomMonthGrid, selectedDate]);

  // 每天的时间标记数量（用于热力图颜色深浅）
  // 由于日记内容是加密存储的，使用标签数量 + 起床/入睡时间来判断活跃度
  const diaryIntensity = useMemo(() => {
    const map = new Map<string, number>();
    diaryDates.forEach((diary, dateKey) => {
      const tagCount = diary.tags?.length || 0;
      let level: number;
      if (tagCount === 0 && !diary.wake_time && !diary.sleep_time) level = 1;
      else if (tagCount <= 5) level = 2;
      else if (tagCount <= 10) level = 3;
      else if (tagCount <= 20) level = 4;
      else level = 5;
      map.set(dateKey, level);
    });
    return map;
  }, [diaryDates]);

  if (authLoading || !user) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 pt-0 pb-6 md:py-8">
      {/* 手机页头 */}
      <div className="lg:hidden mb-4 bg-surface dark:bg-slate-800 -mx-4 px-4 py-3">
        <div className="flex items-center justify-center">
          <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">日历</span>
        </div>
      </div>

      {error && <div className="mb-4 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-500 text-sm rounded-xl">{error}</div>}

      {/* ═══ 热力图 + 年份导航 ═══ */}
      <div className="bg-surface dark:bg-slate-800 rounded-none sm:rounded-2xl border-0 sm:border sm:border-gray-100 dark:sm:border-slate-700/50 p-4 md:p-5 relative">
        {/* 加载状态（覆盖热力图区域） */}
        {loading && (
          <div className="absolute inset-0 z-10 bg-white/80 dark:bg-slate-800/80 rounded-none sm:rounded-2xl flex items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-slate-500">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              加载中...
            </div>
          </div>
        )}
        {/* 年份导航（固定不滚动） */}
        <div className="flex items-center justify-between mb-3 select-none">
          <button onClick={() => { setCurrentYear(nowYear); setSelectedDate(null); setPreviewDiary(null); }}
            className="text-base font-extrabold text-gray-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            今年
          </button>
          <div className="flex items-center gap-1">
            <button onClick={() => { setCurrentYear(y => y - 1); setSelectedDate(null); setPreviewDiary(null); }}
              className="w-7 h-7 flex items-center justify-center border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className="text-base font-semibold text-gray-700 dark:text-slate-200 min-w-[60px] text-center">
              {currentYear}
            </span>
            <button onClick={() => { setCurrentYear(y => y + 1); setSelectedDate(null); setPreviewDiary(null); }}
              className="w-7 h-7 flex items-center justify-center border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
          <div className="text-xs text-gray-400 dark:text-slate-500">
            活跃天数 <span className="font-semibold text-gray-600 dark:text-slate-300">{diaryCount}</span> 天 · {currentYear}
          </div>
        </div>

        {/* 月份区域（横向滚动） */}
        <div ref={scrollRef} className="overflow-x-auto pt-2 pb-2 scroll-smooth [&::-webkit-scrollbar]:h-1">
          <div className="flex w-fit">
          {months.map(({ monthIndex, rows }) => {
            const isCurrentMonth = monthIndex === nowMonth && currentYear === nowYear;
            return (
              <div key={monthIndex} ref={isCurrentMonth ? currentMonthRef : null} className="shrink-0 w-[90px] md:w-[95px]">
                <div className={`p-1.5 rounded ${
                  isCurrentMonth ? "bg-blue-50/70 dark:bg-blue-900/15 ring-1 ring-blue-300 dark:ring-blue-700" : ""
                }`}>
                  {/* 热力方块 */}
                  {rows.map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7 gap-[1px] mb-[1px]">
                      {week.map((day, di) => {
                        const inMonth = day.getMonth() === monthIndex;
                        if (!inMonth) return <div key={`e-${wi}-${di}`} className="w-full aspect-square" />;
                        const dateKey = formatDateFn(day, "yyyy-MM-dd");
                        const hasDiary = diaryDates.has(dateKey);
                        const intensity = diaryIntensity.get(dateKey) || 1;
                        const isSel = selectedDate && isSameDay(day, selectedDate);
                        const isTd = isToday(day);
                        return (
                          <button key={dateKey} type="button" onClick={() => handleDateClick(day)}
                            title={formatDateFn(day, "M月d日") + (hasDiary ? ` · ${intensity}/4` : "")}
                            style={{ backgroundColor: !hasDiary || intensity === 1 ? "#d1d5db" : ["#93c5fd","#60a5fa","#3b82f6","#1e40af"][intensity - 2] || "#3b82f6" }}
                            className={`w-full aspect-square rounded-[2px] transition-all ${isSel ? "ring-2 ring-blue-300" : ""} ${isTd && !isSel ? "ring-1 ring-blue-400" : ""} hover:opacity-80 hover:scale-110`}>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                  {/* 月份放到底部 */}
                  <div className="text-[9px] text-gray-400 dark:text-slate-500 text-center mt-1 leading-none select-none">
                    {monthIndex + 1}月
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </div>

        {/* 图例 */}
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-100 dark:border-slate-700 text-xs text-gray-400 dark:text-slate-500">
          <span>少</span>
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#d1d5db" }} />
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#93c5fd" }} />
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#60a5fa" }} />
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#3b82f6" }} />
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#1e40af" }} />
          <span>多</span>
          <span className="ml-auto">← 滑动 →</span>
        </div>
      </div>

      {/* ═══ 底部：左侧大月历 + 右侧日记预览 ═══ */}
      <div className="mt-4 flex flex-col lg:flex-row gap-4">
        {/* 左侧：大月历/周历 */}
        <div className="lg:w-72 shrink-0">
          <div className="bg-surface dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-3 md:p-4">
            {/* 手机端：周导航 + 当前周 */}
            <div className="lg:hidden">
              <div className="flex items-center justify-between mb-3">
                <button onClick={() => {
                  const d = new Date(selectedDate || new Date());
                  d.setDate(d.getDate() - 7);
                  handleDateClick(d);
                }}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-xs">◀</button>
                <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">
                  {currentYear}年 {bottomMonth + 1}月 第{Math.ceil((selectedDate || new Date()).getDate() / 7)}周
                </span>
                <button onClick={() => {
                  const d = new Date(selectedDate || new Date());
                  d.setDate(d.getDate() + 7);
                  handleDateClick(d);
                }}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-xs">▶</button>
              </div>
              <div className="grid grid-cols-7 mb-1">
                {weekDays.map((d, i) => (
                  <div key={d} className={`text-center text-[10px] font-medium py-1 ${i >= 5 ? "text-red-400" : "text-gray-400 dark:text-slate-500"}`}>{d}</div>
                ))}
              </div>
              <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
                {currentWeekRows.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7">
                    {week.map((day, di) => {
                      const inMonth = day.getMonth() === bottomMonth;
                      const key = formatDateFn(day, "yyyy-MM-dd");
                      const hasDiary = diaryDates.has(key);
                      const isSel = selectedDate && isSameDay(day, selectedDate);
                      const isTd = isToday(day);
                      if (!inMonth) return <div key={`e-${wi}-${di}`} className="w-full h-10" />;
                      return (
                        <button key={key} onClick={() => handleDateClick(day)}
                          className={`relative flex flex-col items-center justify-center h-10
                            border-r border-b border-gray-200 dark:border-slate-700 transition-colors cursor-pointer
                            hover:bg-blue-50/60 dark:hover:bg-blue-900/20
                            ${isSel ? "bg-blue-50 dark:bg-blue-900/20" : ""}
                            ${di === 6 ? "border-r-0" : ""}
                            ${wi === currentWeekRows.length - 1 ? "border-b-0" : ""}
                          `}>
                          <span className={`flex items-center justify-center w-6 h-6 rounded-full text-[11px] leading-none p-0 transition-colors
                            ${isSel ? "bg-blue-500 text-white font-bold" : ""}
                            ${!isSel && isTd ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold" : ""}
                            ${!isSel && !isTd && inMonth ? "text-gray-700 dark:text-slate-200" : ""}
                            ${!inMonth ? "text-gray-300 dark:text-slate-600" : ""}`}>
                            {day.getDate()}
                          </span>
                          {hasDiary && (
                            <span className={`absolute bottom-0.5 w-1 h-1 rounded-full bg-blue-500 dark:bg-blue-400`} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            {/* 桌面端：月导航 + 完整月历 */}
            <div className="hidden lg:block">
              <div className="flex items-center justify-between mb-3">
                <button onClick={() => setBottomMonth(m => m === 0 ? 11 : m - 1)}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-xs">◀</button>
                <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">
                  {currentYear}年 {bottomMonth + 1}月
                </span>
                <button onClick={() => setBottomMonth(m => m === 11 ? 0 : m + 1)}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-xs">▶</button>
              </div>
              <div className="grid grid-cols-7 mb-1">
                {weekDays.map((d, i) => (
                  <div key={d} className={`text-center text-[10px] font-medium py-1 ${i >= 5 ? "text-red-400" : "text-gray-400 dark:text-slate-500"}`}>{d}</div>
                ))}
              </div>
              <div className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
                {bottomMonthGrid.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7">
                    {week.map((day, di) => {
                      const inMonth = day.getMonth() === bottomMonth;
                      const key = formatDateFn(day, "yyyy-MM-dd");
                      const hasDiary = diaryDates.has(key);
                      const isSel = selectedDate && isSameDay(day, selectedDate);
                      const isTd = isToday(day);
                      return (
                        <button key={key} onClick={() => handleDateClick(day)}
                          className={`relative flex flex-col items-center justify-center h-12
                            border-r border-b border-gray-200 dark:border-slate-700 transition-colors cursor-pointer
                            ${!inMonth ? "bg-gray-50/50 dark:bg-slate-800/20" : "hover:bg-blue-50/60 dark:hover:bg-blue-900/20"}
                            ${isSel ? "bg-blue-50 dark:bg-blue-900/20" : ""}
                            ${di === 6 ? "border-r-0" : ""}
                            ${wi === bottomMonthGrid.length - 1 ? "border-b-0" : ""}
                          `}>
                          <span className={`flex items-center justify-center w-6 h-6 rounded-full text-[11px] leading-none p-0 transition-colors
                            ${isSel || (isTd && selectedDate === null) ? "bg-blue-500 text-white font-bold" : ""}
                            ${!isSel && isTd && selectedDate !== null ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold" : ""}
                            ${!isSel && !isTd && inMonth ? "text-gray-700 dark:text-slate-200" : ""}
                            ${!inMonth ? "text-gray-300 dark:text-slate-600" : ""}`}>
                            {day.getDate()}
                          </span>
                          {hasDiary && (
                            <span className={`absolute bottom-0.5 w-1 h-1 rounded-full bg-blue-500 dark:bg-blue-400`} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 右侧：日记预览 */}
        <div className="flex-1 min-w-0">
          {selectedDate ? (
            <div className="bg-surface dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-4 md:p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200">
                  {formatDateFn(selectedDate, "yyyy年 M月d日 EEEE", { locale: zhCN })}
                </h3>
              </div>
              {previewDiary ? (
                <div className="mt-3 space-y-3">
                  {(previewDiary.wake_time || previewDiary.sleep_time) && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {previewDiary.wake_time && (
                        <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-md">
                          ⏰ 起床 {previewDiary.wake_time.split("T")[1]?.slice(0, 5) || previewDiary.wake_time}
                        </span>
                      )}
                      {previewDiary.sleep_time && (
                        <span className="text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-md">
                          🌙 入睡 {previewDiary.sleep_time.split("T")[1]?.slice(0, 5) || previewDiary.sleep_time}
                        </span>
                      )}
                    </div>
                  )}
                  {previewDiary.tags && previewDiary.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {previewDiary.tags.map((t) => (
                        <span key={t.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs cursor-pointer hover:opacity-80"
                          style={{ backgroundColor: (t.tag?.color || "#3B82F6") + "20", color: t.tag?.color || "#3B82F6" }}
                          onClick={() => { setSelectedTag(t.tag?.name || null); router.push("/write"); }}>
                          #{t.tag?.name || "?"} {t.time_label && <span className="opacity-60">{t.time_label}</span>}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap border-t border-gray-100 dark:border-slate-700 pt-3">
                    {(previewDiary.content || "").slice(0, 400)}
                    {(previewDiary.content || "").length > 400 ? "..." : ""}
                  </p>
                  <button onClick={() => router.push("/write")}
                    className="w-full pt-2 mt-2 text-sm font-semibold text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors border-t border-gray-100 dark:border-slate-700">编辑日记</button>
                </div>
              ) : (
                <div className="mt-4 text-sm text-gray-400 dark:text-slate-500">
                  <p>📭 这天还没写日记</p>
                  <button onClick={() => router.push("/write")}
                    className="mt-2 px-4 py-1.5 bg-blue-500 dark:bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-600 active:scale-[0.98] transition-all shadow-sm shadow-blue-500/20 inline-block">去写日记 →</button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-gray-200 dark:border-slate-700 p-4 text-sm text-gray-400 dark:text-slate-500 text-center h-full flex items-center justify-center">
              <p className="py-4">👆 点击日期查看日记预览</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
