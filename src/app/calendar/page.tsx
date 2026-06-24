"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import {
  format as formatDateFn,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from "date-fns";
import { zhCN } from "date-fns/locale";
import type { Diary } from "@/types";

export default function CalendarPage() {
  const { user, session, loading: authLoading } = useAuth();
  const router = useRouter();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [diaryDates, setDiaryDates] = useState<Map<string, Diary>>(new Map());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [previewDiary, setPreviewDiary] = useState<Diary | null>(null);
  const [loading, setLoading] = useState(false);

  // 未登录 → 跳转
  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth");
  }, [user, authLoading, router]);

  // 获取用户当月日记
  const fetchMonthDiaries = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);

    const start = formatDateFn(startOfMonth(currentMonth), "yyyy-MM-dd");
    const end = formatDateFn(endOfMonth(currentMonth), "yyyy-MM-dd");

    try {
      const res = await fetch(
        `/api/diaries?start=${start}&end=${end}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const json = await res.json();
      const list: Diary[] = json.data || [];
      const map = new Map<string, Diary>();
      list.forEach((d) => map.set(d.date, d));
      setDiaryDates(map);
    } catch (e) {
      console.error("Failed to load month diaries", e);
    }
    setLoading(false);
  }, [currentMonth, session?.access_token]);

  useEffect(() => {
    fetchMonthDiaries();
  }, [fetchMonthDiaries]);

  // 点击日期查看预览
  async function handleDateClick(date: Date) {
    const key = formatDateFn(date, "yyyy-MM-dd");
    setSelectedDate(date);

    if (diaryDates.has(key)) {
      setPreviewDiary(diaryDates.get(key) || null);
    } else {
      setPreviewDiary(null);
    }
  }

  // 生成日历网格
  const calendarGrid = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const rows: Date[][] = [];
    let current = calStart;
    while (current <= calEnd) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(current);
        current = addDays(current, 1);
      }
      rows.push(week);
    }
    return rows;
  }, [currentMonth]);

  // 星期头
  const weekDays = ["一", "二", "三", "四", "五", "六", "日"];

  if (authLoading || !user) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">📅 日历</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 rounded-lg hover:bg-[var(--muted)] transition-colors"
          >
            ◀
          </button>
          <span className="text-lg font-medium min-w-[120px] text-center">
            {formatDateFn(currentMonth, "yyyy年 M月", { locale: zhCN })}
          </span>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 rounded-lg hover:bg-[var(--muted)] transition-colors"
          >
            ▶
          </button>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="text-sm text-[var(--accent)] hover:underline ml-2"
          >
            今天
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Calendar grid */}
        <div className="flex-1">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {weekDays.map((d, i) => (
              <div
                key={d}
                className={`text-center text-xs font-medium py-2 ${
                  i >= 5 ? "text-red-400" : "text-[var(--text-muted)]"
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="border border-[var(--border)] rounded-xl overflow-hidden">
            {calendarGrid.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7">
                {week.map((day, di) => {
                  const key = formatDateFn(day, "yyyy-MM-dd");
                  const hasDiary = diaryDates.has(key);
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const today = isToday(day);

                  return (
                    <button
                      key={key}
                      onClick={() => handleDateClick(day)}
                      className={`relative flex flex-col items-center justify-center h-14 md:h-16
                        border-r border-b border-[var(--border)] transition-colors
                        ${!isCurrentMonth ? "bg-[var(--muted)] text-[var(--text-muted)]" : "hover:bg-blue-50"}
                        ${isSelected ? "bg-blue-100" : ""}
                        ${di === 6 ? "border-r-0" : ""}
                        ${wi === calendarGrid.length - 1 ? "border-b-0" : ""}
                      `}
                    >
                      <span
                        className={`text-sm ${
                          today
                            ? "inline-flex items-center justify-center w-7 h-7 rounded-full bg-[var(--accent)] text-white"
                            : isCurrentMonth
                            ? "text-[var(--foreground)]"
                            : ""
                        }`}
                      >
                        {day.getDate()}
                      </span>
                      {hasDiary && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Preview panel */}
        <div className="lg:w-72 shrink-0">
          {selectedDate ? (
            <div className="p-4 bg-white border border-[var(--border)] rounded-xl">
              <h3 className="text-sm font-medium mb-1">
                {formatDateFn(selectedDate, "M月d日 EEEE", { locale: zhCN })}
              </h3>

              {previewDiary ? (
                <div className="mt-3 space-y-3">
                  {/* 起床/入睡 */}
                  {(previewDiary.wake_time || previewDiary.sleep_time) && (
                    <div className="flex gap-3 text-xs">
                      {previewDiary.wake_time && (
                        <span className="text-[var(--accent)]">
                          ⏰ 起床 {previewDiary.wake_time.replace("T", " ")}
                        </span>
                      )}
                      {previewDiary.sleep_time && (
                        <span className="text-indigo-500">
                          🌙 入睡 {previewDiary.sleep_time.replace("T", " ")}
                        </span>
                      )}
                    </div>
                  )}

                  {/* 标签 */}
                  {previewDiary.tags && previewDiary.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {previewDiary.tags.map((t) => (
                        <span
                          key={t.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                          style={{
                            backgroundColor: (t.tag?.color || "#3B82F6") + "20",
                            color: t.tag?.color || "#3B82F6",
                          }}
                        >
                          #{t.tag?.name || "?"}
                          {t.time_label && (
                            <span className="opacity-60">{t.time_label}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 日记正文 */}
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                    {previewDiary.content.slice(0, 300)}
                    {previewDiary.content.length > 300 ? "..." : ""}
                  </p>

                  <button
                    onClick={() => router.push("/")}
                    className="w-full mt-2 py-2 text-xs text-[var(--accent)] border border-[var(--border)] rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    查看/编辑完整日记 →
                  </button>
                </div>
              ) : (
                <div className="mt-3 text-sm text-[var(--text-muted)]">
                  <p>这天还没写日记</p>
                  <button
                    onClick={() => router.push("/")}
                    className="mt-2 w-full py-2 text-xs text-[var(--accent)] border border-[var(--border)] rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    去写日记 →
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-[var(--muted)] rounded-xl border border-[var(--border)] text-sm text-[var(--text-muted)]">
              点击日历中的日期查看日记预览
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
