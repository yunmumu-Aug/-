"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useChartData } from "@/hooks/use-charts";
import { getWeekRange, getMonthRange } from "@/lib/diary-utils";
import { generateHeatmapData } from "@/lib/chart-utils";
import { format as formatDateFn, startOfYear, endOfYear } from "date-fns";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from "recharts";
import type { TagStat } from "@/types";

/* ================================================================
   Constants
   ================================================================ */

const RANGES = ["today", "week", "month", "year"] as const;
type Range = (typeof RANGES)[number];

function getTodayStr() { return formatDateFn(new Date(), "yyyy-MM-dd"); }

// 饼图专用色板 — 固定的高区分度颜色列表
const PIE_COLORS = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B",
  "#8B5CF6", "#EC4899", "#6366F1", "#F97316",
  "#06B6D4", "#84CC16", "#E11D48", "#14B8A6",
  "#D946EF", "#FB923C", "#22D3EE", "#A3E635",
];

// 固定色板饼图数据
function tagStatToPieData(stats: TagStat[]) {
  return stats.map((s, i) => ({
    name: s.tagName,
    value: s.count,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }));
}

function sleepToBarData(sleepData: { date: string; durationHours: number | null }[]) {
  return sleepData
    .filter((d) => d.durationHours !== null)
    .map((d) => ({ name: d.date.slice(5), hours: parseFloat(d.durationHours!.toFixed(1)) }));
}

/* ================================================================
   Sub-components
   ================================================================ */

/** Horizontal bar chart for rankings */
function HorizontalBar({ data }: { data: TagStat[] }) {
  const top = data.slice(0, 8);
  return (
    <div className="space-y-2">
      {top.length === 0 && <p className="text-sm text-[var(--text-muted)]">暂无数据</p>}
      {top.map((s, i) => (
        <div key={s.tagId} className="flex items-center gap-2 text-sm">
          <span className="w-4 text-right text-xs text-[var(--text-muted)]">{i + 1}</span>
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
          <span className="w-12 truncate">{s.tagName}</span>
          <div className="flex-1 bg-[var(--muted)] rounded-full h-4 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${top[0].count > 0 ? (s.count / top[0].count) * 100 : 0}%`,
                background: s.color,
                opacity: 0.7,
              }}
            />
          </div>
          <span className="text-xs text-[var(--text-muted)] w-10 text-right">{s.count}次</span>
        </div>
      ))}
    </div>
  );
}

/** Summary card */
function SummaryCard({ summary }: { summary: any }) {
  if (!summary) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
      {summary.totalDiaries > 0 && (
        <div className="p-2 bg-[var(--muted)] rounded-lg">
          <div className="text-[var(--text-muted)]">日记数</div>
          <div className="text-lg font-semibold mt-0.5">{summary.totalDiaries}</div>
        </div>
      )}
      {summary.topTag && (
        <div className="p-2 bg-[var(--muted)] rounded-lg">
          <div className="text-[var(--text-muted)]">最高频</div>
          <div className="text-lg font-semibold mt-0.5">{summary.topTag.name}</div>
        </div>
      )}
      {summary.avgSleepHours && (
        <div className="p-2 bg-[var(--muted)] rounded-lg">
          <div className="text-[var(--text-muted)]">平均睡眠</div>
          <div className="text-lg font-semibold mt-0.5">{summary.avgSleepHours}h</div>
        </div>
      )}
      {summary.longestStreak > 0 && (
        <div className="p-2 bg-[var(--muted)] rounded-lg">
          <div className="text-[var(--text-muted)]">最长连续</div>
          <div className="text-lg font-semibold mt-0.5">{summary.longestStreak}天</div>
        </div>
      )}
      {summary.earliestWake && (
        <div className="p-2 bg-[var(--muted)] rounded-lg">
          <div className="text-[var(--text-muted)]">最早起</div>
          <div className="text-lg font-semibold mt-0.5">{summary.earliestWake?.replace("T", " ")}</div>
        </div>
      )}
      {summary.latestWake && (
        <div className="p-2 bg-[var(--muted)] rounded-lg">
          <div className="text-[var(--text-muted)]">最晚起</div>
          <div className="text-lg font-semibold mt-0.5">{summary.latestWake?.replace("T", " ")}</div>
        </div>
      )}
    </div>
  );
}

/** Pie wrapper */
function PieBlock({ title, data }: { title: string; data: { name: string; value: number; color: string }[] }) {
  if (data.length === 0) return <EmptyBlock title={title} />;
  return (
    <div className="bg-white border border-[var(--border)] rounded-xl p-4">
      <h3 className="text-sm font-medium mb-2">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={true as any}>
            {data.map((d, i) => (<Cell key={i} fill={d.color} />))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Bar wrapper */
function BarBlock({ title, data, color }: { title: string; data: { name: string; value?: number; hours?: number }[]; color?: string }) {
  const c = color || "#3B82F6";
  if (data.length === 0) return <EmptyBlock title={title} />;
  return (
    <div className="bg-white border border-[var(--border)] rounded-xl p-4">
      <h3 className="text-sm font-medium mb-2">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="value" fill={c} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Line wrapper */
function LineBlock({ title, data, color }: { title: string; data: { name: string; hours?: number }[]; color?: string }) {
  const c = color || "#3B82F6";
  if (data.length === 0) return <EmptyBlock title={title} />;
  return (
    <div className="bg-white border border-[var(--border)] rounded-xl p-4">
      <h3 className="text-sm font-medium mb-2">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line type="monotone" dataKey="hours" stroke={c} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyBlock({ title }: { title: string }) {
  return (
    <div className="bg-white border border-[var(--border)] rounded-xl p-4 flex items-center justify-center h-[200px]">
      <p className="text-sm text-[var(--text-muted)]">{title} — 暂无数据</p>
    </div>
  );
}

/** 24h timeline for a single diary — sleep hours collapsed */
function Timeline24h({ diary }: { diary: any }) {
  if (!diary) return null;

  interface EventItem {
    start: number;
    label: string;
    color: string;
  }

  let sleepStart = 23;
  let sleepEnd = 7;
  let hasSleep = false;

  if (diary.sleep_time && diary.wake_time) {
    const parseTime = (t: string) => {
      const clean = t.includes("T") ? t.split("T")[1].slice(0, 5) : t;
      const [h, m] = clean.split(":").map(Number);
      return h + m / 60;
    };
    sleepStart = parseTime(diary.sleep_time);
    sleepEnd = parseTime(diary.wake_time);
    hasSleep = true;
  }

  const sleepHours = hasSleep
    ? (sleepEnd > sleepStart ? (sleepEnd - sleepStart) : (24 - sleepStart + sleepEnd)).toFixed(1)
    : "0";

  const fmt = (v: number) => {
    const h = Math.floor(v);
    const m = Math.round((v - h) * 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  function isSleepHour(h: number): boolean {
    if (!hasSleep) return false;
    if (sleepStart < sleepEnd) return h >= sleepStart && h < sleepEnd;
    return h >= sleepStart || h < sleepEnd;
  }

  // 收集标签
  const tagEvents: EventItem[] = [];
  if (diary.tags) {
    for (const t of diary.tags) {
      if (t.time_label) {
        const [h, m] = t.time_label.split(":").map(Number);
        tagEvents.push({ start: h + m / 60, label: t.tag?.name || "?", color: t.tag?.color || "#3B82F6" });
      }
    }
  }

  const hourHeight = 22;
  const sleepBlockH = 36;

  // 构建显示行：清醒小时 (type: "hour") + 睡眠块 (type: "sleep")
  interface Row {
    type: "hour" | "sleep";
    hour?: number;
    sleepLabel?: string;
  }

  const rows: Row[] = [];
  for (let h = 0; h < 24; h++) {
    if (isSleepHour(h)) {
      if (h === Math.floor(sleepStart)) {
        rows.push({ type: "sleep", sleepLabel: `🌙 睡觉 ${fmt(sleepStart)} → ${fmt(sleepEnd)}  共 ${sleepHours} 小时` });
      }
    } else {
      rows.push({ type: "hour", hour: h });
    }
  }

  return (
    <div className="bg-white border border-[var(--border)] rounded-xl p-4 overflow-x-auto">
      <h3 className="text-sm font-medium mb-3">🕐 {diary.date} 24小时时间轴</h3>
      <div className="flex">
        <div className="flex-1 min-w-0">
          {rows.map((row, idx) => (
            <div key={idx} className="flex items-start">
              {/* 时间标签 */}
              <div className="shrink-0 w-12 text-right pr-2">
                <span className="text-xs text-[var(--text-muted)] leading-none block" style={{ marginTop: row.type === "sleep" ? 14 : 6 }}>
                  {row.type === "hour" ? `${row.hour}:00` : fmt(sleepStart)}
                </span>
              </div>

              {/* 内容 */}
              <div className="flex-1 relative border-l-2 border-[var(--border)]" style={{ minHeight: row.type === "sleep" ? sleepBlockH : hourHeight }}>
                <div className="absolute left-0 right-0 top-0 border-t border-dashed border-gray-100" />

                {row.type === "sleep" ? (
                  <div
                    className="absolute left-1 right-2 rounded-md flex items-center px-3"
                    style={{
                      top: 5,
                      bottom: 5,
                      backgroundColor: "#818CF815",
                      borderLeft: "3px solid #818CF8",
                    }}
                  >
                    <span className="text-[13px] font-medium text-[#6366F1]">{row.sleepLabel}</span>
                  </div>
                ) : (
                  <div className="flex gap-1.5 py-1 pl-1">
                    {tagEvents
                      .filter(ev => Math.floor(ev.start) === row.hour)
                      .map((ev, j) => (
                        <div
                          key={j}
                          className="rounded px-2 py-0.5 flex items-center gap-1 shrink-0"
                          style={{ backgroundColor: ev.color + "15", borderLeft: `2px solid ${ev.color}` }}
                        >
                          <span className="text-xs font-medium leading-none truncate" style={{ color: ev.color }}>
                            {ev.label}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Yearly heatmap */
function YearHeatmap({ diaries, year }: { diaries: any[]; year: number }) {
  const heatmap = generateHeatmapData(diaries, year);
  // Group by month
  const months: { label: string; days: typeof heatmap }[] = [];
  for (let m = 0; m < 12; m++) {
    const start = new Date(year, m, 1);
    const label = formatDateFn(start, "M月");
    const days = heatmap.filter((d) => d.date.startsWith(formatDateFn(start, "yyyy-MM").slice(0, 7)));
    months.push({ label, days });
  }

  const maxCount = Math.max(1, ...heatmap.map((d) => d.count));

  function colorFor(count: number): string {
    if (!count) return "#F3F4F6";
    const ratio = count / maxCount;
    if (ratio < 0.25) return "#DBEAFE";
    if (ratio < 0.5) return "#93C5FD";
    if (ratio < 0.75) return "#3B82F6";
    return "#1D4ED8";
  }

  return (
    <div className="bg-white border border-[var(--border)] rounded-xl p-4">
      <h3 className="text-sm font-medium mb-3">🗓️ {year}年 活跃热力图</h3>
      <div className="flex flex-wrap gap-4">
        {months.map((m) => (
          <div key={m.label} className="flex flex-col gap-0.5">
            <span className="text-[10px] text-[var(--text-muted)] mb-0.5">{m.label}</span>
            <div className="grid grid-cols-7 gap-0.5">
              {m.days.map((d) => (
                <div
                  key={d.date}
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: colorFor(d.count) }}
                  title={`${d.date}: ${d.count}个活动`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-3 text-[10px] text-[var(--text-muted)]">
        <span className="w-3 h-3 rounded-sm" style={{ background: "#F3F4F6" }} />
        <span>无</span>
        <span className="w-3 h-3 rounded-sm" style={{ background: "#DBEAFE" }} />
        <span>少</span>
        <span className="w-3 h-3 rounded-sm" style={{ background: "#93C5FD" }} />
        <span className="w-3 h-3 rounded-sm" style={{ background: "#3B82F6" }} />
        <span className="w-3 h-3 rounded-sm" style={{ background: "#1D4ED8" }} />
        <span>多</span>
      </div>
    </div>
  );
}

/* ================================================================
   Main page
   ================================================================ */

export default function ChartsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [range, setRange] = useState<Range>("today");
  const [selectedDate, setSelectedDate] = useState(getTodayStr());

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth");
  }, [user, authLoading, router]);

  // 计算日期范围
  const { start, end } = useMemo(() => {
    const now = new Date();
    switch (range) {
      case "today":
        return { start: getTodayStr(), end: getTodayStr() };
      case "week": {
        const w = getWeekRange(now);
        return { start: formatDateFn(w.start, "yyyy-MM-dd"), end: formatDateFn(w.end, "yyyy-MM-dd") };
      }
      case "month": {
        const m = getMonthRange(now);
        return { start: formatDateFn(m.start, "yyyy-MM-dd"), end: formatDateFn(m.end, "yyyy-MM-dd") };
      }
      case "year":
        return {
          start: formatDateFn(startOfYear(now), "yyyy-MM-dd"),
          end: formatDateFn(endOfYear(now), "yyyy-MM-dd"),
        };
    }
  }, [range]);

  const { diaries, tagStats, sleepData, summary, loading } = useChartData(start, end);

  // 本周每日标签数据
  const dailyBarData = useMemo(() => {
    if (range !== "week") return [];
    return diaries.map((d) => ({
      name: d.date.slice(5),
      value: d.tags?.length || 0,
    }));
  }, [diaries, range]);

  // 本月每周标签数据
  const weeklyBarData = useMemo(() => {
    if (range !== "month") return [];
    const weeks: Record<string, number> = {};
    diaries.forEach((d) => {
      const wk = `W${Math.ceil(parseInt(d.date.slice(8)) / 7)}`;
      weeks[wk] = (weeks[wk] || 0) + (d.tags?.length || 0);
    });
    return Object.entries(weeks).map(([name, value]) => ({ name, value }));
  }, [diaries, range]);

  // 年度月度数据
  const monthlyTagBarData = useMemo(() => {
    if (range !== "year") return [];
    const months: Record<string, number> = {};
    diaries.forEach((d) => {
      const mo = d.date.slice(5, 7) + "月";
      months[mo] = (months[mo] || 0) + (d.tags?.length || 0);
    });
    return Object.entries(months).map(([name, value]) => ({ name, value }));
  }, [diaries, range]);

  // 月度睡眠
  const monthlySleepData = useMemo(() => {
    if (range !== "year") return [];
    const months: Record<string, { total: number; count: number }> = {};
    sleepData.forEach((s) => {
      if (s.durationHours !== null) {
        const mo = s.date.slice(5, 7) + "月";
        if (!months[mo]) months[mo] = { total: 0, count: 0 };
        months[mo].total += s.durationHours;
        months[mo].count++;
      }
    });
    return Object.entries(months).map(([name, d]) => ({ name, hours: Math.round((d.total / d.count) * 10) / 10 }));
  }, [sleepData, range]);

  // 本周睡眠柱状图
  const weeklySleepBars = useMemo(() => {
    if (range !== "week") return [];
    return sleepData
      .filter((s) => s.durationHours !== null)
      .map((s, i) => ({
        name: ["一", "二", "三", "四", "五", "六", "日"][i] || s.date.slice(5),
        value: parseFloat(s.durationHours!.toFixed(1)),
      }));
  }, [sleepData, range]);

  // 本周起床柱状图
  const weekWakeChartData = useMemo(() => {
    if (range !== "week") return [];
    return sleepData
      .filter((s) => s.wakeTime)
      .map((s, i) => {
        const t = s.wakeTime!.includes("T") ? s.wakeTime!.split("T")[1].slice(0, 5) : s.wakeTime!;
        const [h, m] = t.split(":").map(Number);
        return {
          name: ["一", "二", "三", "四", "五", "六", "日"][i] || s.date.slice(5),
          value: parseFloat((h + m / 60).toFixed(1)),
        };
      });
  }, [sleepData, range]);

  // 本月起床时间
  const monthWakeBars = useMemo(() => {
    if (range !== "month") return [];
    return sleepData
      .filter((s) => s.wakeTime)
      .map((s) => {
        const t = s.wakeTime!.includes("T") ? s.wakeTime!.split("T")[1].slice(0, 5) : s.wakeTime!;
        const [h, m] = t.split(":").map(Number);
        return { name: s.date.slice(5), value: parseFloat((h + m / 60).toFixed(1)) };
      });
  }, [sleepData, range]);

  // 入睡分布饼图数据
  const sleepDistData = useMemo(() => {
    let early = 0, late = 0, midnight = 0;
    sleepData.forEach((s) => {
      if (!s.sleepTime) return;
      const t = s.sleepTime.includes("T") ? s.sleepTime.split("T")[1].slice(0, 5) : s.sleepTime;
      const h = parseInt(t.split(":")[0]);
      if (h < 22) early++;
      else if (h <= 23) late++;
      else midnight++;
    });
    return [
      { name: "22点前", value: early, color: "#10B981" },
      { name: "22-23点", value: late, color: "#6366F1" },
      { name: "0点后", value: midnight, color: "#8B5CF6" },
    ].filter((d) => d.value > 0);
  }, [sleepData]);

  // 年度入睡分布
  const yearSleepDistData = useMemo(() => {
    let e = 0, l = 0, m = 0;
    sleepData.forEach((s) => {
      if (!s.sleepTime) return;
      const t = s.sleepTime.includes("T") ? s.sleepTime.split("T")[1].slice(0, 5) : s.sleepTime;
      const h = parseInt(t.split(":")[0]);
      if (h < 22) e++;
      else if (h <= 23) l++;
      else m++;
    });
    return [
      { name: "22点前", value: e, color: "#10B981" },
      { name: "22-23点", value: l, color: "#6366F1" },
      { name: "0点后", value: m, color: "#8B5CF6" },
    ].filter((d) => d.value > 0);
  }, [sleepData]);

  // 年度睡眠
  const yearSleepData = useMemo(() => monthlySleepData, [monthlySleepData]);

  // 年度起床
  const yearWakeBars = useMemo(() => {
    if (range !== "year") return [];
    const months: Record<string, { total: number; count: number }> = {};
    sleepData.forEach((s) => {
      if (s.wakeTime) {
        const mo = s.date.slice(5, 7) + "月";
        const t = s.wakeTime.includes("T") ? s.wakeTime.split("T")[1].slice(0, 5) : s.wakeTime;
        const [h, m] = t.split(":").map(Number);
        if (!months[mo]) months[mo] = { total: 0, count: 0 };
        months[mo].total += h + m / 60;
        months[mo].count++;
      }
    });
    return Object.entries(months).map(([name, d]) => ({ name, value: Math.round((d.total / d.count) * 10) / 10 }));
  }, [sleepData, range]);

  if (authLoading || !user) return null;

  const todayDiary = range === "today" ? diaries[0] : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 md:py-8">
      {/* Header + tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-3">
        <h1 className="text-2xl font-semibold">📊 图表分析</h1>
        <div className="flex gap-1 bg-[var(--muted)] rounded-lg p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                range === r
                  ? "bg-white text-[var(--accent)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--foreground)]"
              }`}
            >
              {{ today: "今天", week: "本周", month: "本月", year: "年度" }[r]}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="text-center py-20 text-[var(--text-muted)]">加载中...</div>
      )}

      {!loading && diaries.length === 0 && (
        <div className="text-center py-20 text-[var(--text-muted)]">
          <p className="text-lg mb-1">📭 暂无数据</p>
          <p className="text-sm">去写几篇日记再来看图表吧！</p>
        </div>
      )}

      {!loading && diaries.length > 0 && (
        <div className="space-y-6">
          {/* ---- TODAY ---- */}
          {range === "today" && todayDiary && (
            <>
              <Timeline24h diary={todayDiary} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PieBlock title="今日标签占比" data={tagStatToPieData(tagStats)} />
                {summary && (
                  <div className="bg-white border border-[var(--border)] rounded-xl p-4">
                    <h3 className="text-sm font-medium mb-3">📋 今日概况</h3>
                    <SummaryCard summary={summary} />
                  </div>
                )}
              </div>
            </>
          )}

          {/* ---- WEEK ---- */}
          {range === "week" && (
            <>
              {/* Date selector for timeline */}
              <div className="flex gap-1 flex-wrap">
                {diaries.map((d) => (
                  <button
                    key={d.date}
                    onClick={() => setSelectedDate(d.date)}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                      selectedDate === d.date
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--muted)] text-[var(--text-secondary)] hover:bg-[var(--border)]"
                    }`}
                  >
                    {d.date.slice(5)}
                  </button>
                ))}
              </div>
              {selectedDate && (
                <Timeline24h diary={diaries.find((d) => d.date === selectedDate)} />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PieBlock title="本周标签占比" data={tagStatToPieData(tagStats)} />
                {sleepDistData.length > 0 && <PieBlock title="入睡时间分布" data={sleepDistData} />}
              </div>

              <BarBlock title="每日活动数" data={dailyBarData} color="#3B82F6" />
              {weeklySleepBars.length > 0 && <BarBlock title="每日睡眠时长 (小时)" data={weeklySleepBars} color="#6366F1" />}

              {weekWakeChartData.length > 0 && (
                <BarBlock title="每日起床时间" data={weekWakeChartData} color="#10B981" />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white border border-[var(--border)] rounded-xl p-4">
                  <h3 className="text-sm font-medium mb-3">🏆 本周活动排行</h3>
                  <HorizontalBar data={tagStats} />
                </div>
                {summary && (
                  <div className="bg-white border border-[var(--border)] rounded-xl p-4">
                    <h3 className="text-sm font-medium mb-3">📋 本周总结</h3>
                    <SummaryCard summary={summary} />
                  </div>
                )}
              </div>
            </>
          )}

          {/* ---- MONTH ---- */}
          {range === "month" && (
            <>
              <div className="flex gap-1 flex-wrap">
                {diaries.map((d) => (
                  <button
                    key={d.date}
                    onClick={() => setSelectedDate(d.date)}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                      selectedDate === d.date
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--muted)] text-[var(--text-secondary)] hover:bg-[var(--border)]"
                    }`}
                  >
                    {d.date.slice(5)}
                  </button>
                ))}
              </div>
              {selectedDate && <Timeline24h diary={diaries.find((d) => d.date === selectedDate)} />}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PieBlock title="本月标签占比" data={tagStatToPieData(tagStats)} />
                {sleepDistData.length > 0 && <PieBlock title="入睡时间分布" data={sleepDistData} />}
              </div>

              <BarBlock title="每周活动趋势" data={weeklyBarData} />

              <LineBlock title="本月睡眠趋势 (小时)" data={sleepToBarData(sleepData).map((s: any) => ({ name: s.name, hours: s.hours }))} color="#6366F1" />

              {monthWakeBars.length > 0 && <BarBlock title="每日起床时间" data={monthWakeBars} color="#10B981" />}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white border border-[var(--border)] rounded-xl p-4">
                  <h3 className="text-sm font-medium mb-3">🏆 本月活动排行</h3>
                  <HorizontalBar data={tagStats} />
                </div>
                {summary && (
                  <div className="bg-white border border-[var(--border)] rounded-xl p-4">
                    <h3 className="text-sm font-medium mb-3">📋 月度总结</h3>
                    <SummaryCard summary={summary} />
                  </div>
                )}
              </div>
            </>
          )}

          {/* ---- YEAR ---- */}
          {range === "year" && (
            <>
              <YearHeatmap diaries={diaries} year={new Date().getFullYear()} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PieBlock title="年度标签占比" data={tagStatToPieData(tagStats)} />
                {yearSleepDistData.length > 0 && <PieBlock title="年度入睡分布" data={yearSleepDistData} />}
              </div>

              {monthlyTagBarData.length > 0 && <BarBlock title="每月活动趋势" data={monthlyTagBarData} />}
              {yearSleepData.length > 0 && <LineBlock title="各月平均睡眠 (小时)" data={yearSleepData} color="#6366F1" />}
              {yearWakeBars.length > 0 && <BarBlock title="各月平均起床时间" data={yearWakeBars} color="#10B981" />}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white border border-[var(--border)] rounded-xl p-4">
                  <h3 className="text-sm font-medium mb-3">🏆 年度活动排行</h3>
                  <HorizontalBar data={tagStats} />
                </div>
                {summary && (
                  <div className="bg-white border border-[var(--border)] rounded-xl p-4">
                    <h3 className="text-sm font-medium mb-3">🏅 年度总结</h3>
                    <SummaryCard summary={summary} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
