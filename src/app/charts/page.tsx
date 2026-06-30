"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useTagFilter } from "@/hooks/use-tag-filter";
import { useChartData } from "@/hooks/use-charts";
import { getWeekRange, getMonthRange } from "@/lib/diary-utils";
import { generateHeatmapData, aggregateTagStats } from "@/lib/chart-utils";
import { format as formatDateFn, startOfYear, endOfYear, getISOWeek, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays } from "date-fns";
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
  const router = useRouter();
  const { setSelectedTag } = useTagFilter();
  const top = data.slice(0, 8);
  return (
    <div className="space-y-2">
      {top.length === 0 && <p className="text-sm text-gray-400 dark:text-slate-500">暂无数据</p>}
      {top.map((s, i) => (
        <div key={s.tagId} className="flex items-center gap-2 text-sm cursor-pointer hover:opacity-80"
          onClick={() => { setSelectedTag(s.tagName); router.push("/write"); }}>
          <span className="w-4 text-right text-xs text-gray-400 dark:text-slate-500">{i + 1}</span>
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
          <span className="w-22 truncate">{s.tagName}</span>
          <div className="flex-1 bg-gray-50 dark:bg-slate-800 rounded-full h-4 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${top[0].count > 0 ? (s.count / top[0].count) * 100 : 0}%`,
                background: s.color,
                opacity: 0.7,
              }}
            />
          </div>
          <span className="text-xs text-gray-400 dark:text-slate-500 w-10 text-right">{s.count}次</span>
        </div>
      ))}
    </div>
  );
}

/** Summary card */
function SummaryCard({ summary, todayDiary }: { summary: any; todayDiary?: any }) {
  if (!summary) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
      {summary.totalDiaries > 0 && !todayDiary && (
        <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
          <div className="text-gray-400 dark:text-slate-500">日记数</div>
          <div className="text-lg font-semibold mt-0.5">{summary.totalDiaries}</div>
        </div>
      )}
      {todayDiary && (
        <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
          <div className="text-gray-400 dark:text-slate-500">今日事件数</div>
          <div className="text-lg font-semibold mt-0.5">{new Set(todayDiary.tags?.map((t: any) => t.tag_id || t.tag?.name) || []).size}</div>
        </div>
      )}
      {summary.topTag && (
        <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
          <div className="text-gray-400 dark:text-slate-500">最高频</div>
          <div className="text-lg font-semibold mt-0.5">{summary.topTag.name}</div>
        </div>
      )}
      {summary.avgSleepHours && !todayDiary && (
        <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
          <div className="text-gray-400 dark:text-slate-500">平均睡眠</div>
          <div className="text-lg font-semibold mt-0.5">{summary.avgSleepHours}h</div>
        </div>
      )}
      {todayDiary && todayDiary.wake_time && (
        <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
          <div className="text-gray-400 dark:text-slate-500">起床</div>
          <div className="text-lg font-semibold mt-0.5">{todayDiary.wake_time.split("T")[1]?.slice(0, 5)}</div>
        </div>
      )}
      {todayDiary && todayDiary.sleep_time && (
        <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
          <div className="text-gray-400 dark:text-slate-500">入睡</div>
          <div className="text-lg font-semibold mt-0.5">{todayDiary.sleep_time.split("T")[1]?.slice(0, 5)}</div>
        </div>
      )}
      {summary.avgSleepHours && todayDiary && (
        <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
          <div className="text-gray-400 dark:text-slate-500">睡眠时长</div>
          <div className="text-lg font-semibold mt-0.5">{summary.avgSleepHours}h</div>
        </div>
      )}
      {summary.longestStreak > 0 && !todayDiary && (
        <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
          <div className="text-gray-400 dark:text-slate-500">最长连续</div>
          <div className="text-lg font-semibold mt-0.5">{summary.longestStreak}天</div>
        </div>
      )}
      {summary.earliestWake && !todayDiary && (
        <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
          <div className="text-gray-400 dark:text-slate-500">最早起</div>
          <div className="text-lg font-semibold mt-0.5">{summary.earliestWake?.replace("T", " ").slice(5)}</div>
        </div>
      )}
      {summary.latestWake && !todayDiary && (
        <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
          <div className="text-gray-400 dark:text-slate-500">最晚起</div>
          <div className="text-lg font-semibold mt-0.5">{summary.latestWake?.replace("T", " ").slice(5)}</div>
        </div>
      )}
    </div>
  );
}

/** Pie wrapper */
function PieBlock({ title, data }: { title: string; data: { name: string; value: number; color: string }[] }) {
  const router = useRouter();
  const { setSelectedTag } = useTagFilter();
  if (data.length === 0) return <EmptyBlock title={title} />;
  const RADIAN = Math.PI / 180;
  const renderLabel = ({ cx, cy, midAngle, outerRadius, percent, index }: any) => {
    const radius = outerRadius + 24;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const sx = cx + (outerRadius + 6) * Math.cos(-midAngle * RADIAN);
    const sy = cy + (outerRadius + 6) * Math.sin(-midAngle * RADIAN);
    const isRight = x >= cx;
    const ex = x + (isRight ? 8 : -8);
    const textX = ex + (isRight ? 4 : -4);
    const textAnchor = isRight ? "start" : "end";
    const d = data[index];
    if (!d || percent < 0.03) return null;
    return (<g style={{ cursor: "pointer" }} onClick={() => { setSelectedTag(d.name); router.push("/write"); }}>
      <line x1={sx} y1={sy} x2={x} y2={y} stroke={d.color} strokeWidth={1.2} strokeOpacity={0.5} />
      <line x1={x} y1={y} x2={ex} y2={y} stroke={d.color} strokeWidth={1.2} strokeOpacity={0.5} />
      <text x={textX} y={y} textAnchor={textAnchor} fill={d.color} fontSize={12} fontWeight={600} dominantBaseline="central">
        {d.name} {d.value}次
      </text>
    </g>);
  };
  return (
    <div className="bg-surface dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
      <h3 className="text-sm font-medium mb-2">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}
            label={renderLabel} labelLine={false}>
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
  const dataKey = data[0] && "hours" in data[0] ? "hours" : "value";
  return (
    <div className="bg-surface dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
      <h3 className="text-sm font-medium mb-2">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ left: -8, right: 8, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 10 }} width={28} />
          <Tooltip formatter={(val: any) => {
            if (val == null) return ["", ""];
            if (dataKey === "hours") {
              const h = Math.floor(val);
              const m = Math.round((val % 1) * 60);
              return [`${h}小时${m}分`, "睡眠"];
            }
            if (title === "每日活动数" || title === "每周活动趋势" || title === "每月活动趋势") return [val, "活动数"];
            if (title.includes("起床")) {
              const h = Math.floor(val);
              const m = String(Math.round((val % 1) * 60)).padStart(2, "0");
              return [`${h}:${m}`, "起床"];
            }
            return [val, "次数"];
          }} />
          <Bar dataKey={dataKey} fill={c} radius={[4, 4, 0, 0]} />
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
    <div className="bg-surface dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
      <h3 className="text-sm font-medium mb-2">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ left: -8, right: 8, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 10 }} width={28} />
          <Tooltip formatter={(val: any) => {
            if (val == null) return ["", ""];
            if (title.includes("睡眠")) {
              const h = Math.floor(val);
              const m = Math.round((val % 1) * 60);
              return [`${h}小时${m}分`, "睡眠"];
            }
            return [val, ""];
          }} />
          <Line type="monotone" dataKey="hours" stroke={c} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyBlock({ title }: { title: string }) {
  return (
    <div className="bg-surface dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 flex items-center justify-center h-[200px]">
      <p className="text-sm text-gray-400 dark:text-slate-500">{title} — 暂无数据</p>
    </div>
  );
}

/** 24h timeline for a single diary — sleep hours collapsed */
function Timeline24h({ diary, prevDiary }: { diary: any; prevDiary?: any }) {
  if (!diary) return null;

  interface EventItem {
    start: number;
    end?: number;
    label: string;
    color: string;
  }

  let sleepStart = 23;
  let sleepEnd = 7;
  let hasSleep = false;

  if (diary.wake_time) {
    const parseTime = (t: string) => {
      const clean = t.includes("T") ? t.split("T")[1].slice(0, 5) : t;
      const [h, m] = clean.split(":").map(Number);
      return h + m / 60;
    };
    // 入睡时间优先取前一天的日记（熬夜到凌晨的那次入睡）
    const effectiveSleep = prevDiary?.sleep_time || diary.sleep_time;
    if (effectiveSleep) {
      sleepStart = parseTime(effectiveSleep);
      sleepEnd = parseTime(diary.wake_time);
      hasSleep = true;
    }
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
    const startFloor = Math.floor(sleepStart);
    const endFloor = Math.floor(sleepEnd);
    if (sleepStart < sleepEnd) return h >= startFloor && h < endFloor;
    return h >= startFloor || h < endFloor;
  }

  // 收集标签（支持跨小时范围）
  const tagEvents: EventItem[] = [];
  if (diary.tags) {
    for (const t of diary.tags) {
      if (t.time_label) {
        const rangeMatch = t.time_label.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
        if (rangeMatch) {
          const h1 = parseInt(rangeMatch[1], 10);
          const m1 = parseInt(rangeMatch[2], 10);
          const h2 = parseInt(rangeMatch[3], 10);
          const m2 = parseInt(rangeMatch[4], 10);
          tagEvents.push({
            start: h1 + m1 / 60,
            end: h2 + m2 / 60,
            label: `${t.tag?.name || "?"} ${fmt(h1 + m1 / 60)}-${fmt(h2 + m2 / 60)}`,
            color: t.tag?.color || "#3B82F6",
          });
        } else {
          const [h, m] = t.time_label.split(":").map(Number);
          tagEvents.push({ start: h + m / 60, label: t.tag?.name || "?", color: t.tag?.color || "#3B82F6" });
        }
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
  const startFloor = Math.floor(sleepStart);
  const endFloor = Math.floor(sleepEnd);
  for (let h = 0; h < 24; h++) {
    if (h === endFloor) {
      // 结束小时：作为普通小时显示标签事件，同时带睡眠摘要信息
      rows.push({ type: "hour", hour: h, sleepLabel: `🌙 睡觉 ${fmt(sleepStart)} → ${fmt(sleepEnd)}  共 ${sleepHours} 小时` });
    } else if (h === startFloor) {
      rows.push({ type: "sleep", sleepLabel: "" });
    } else if (!isSleepHour(h)) {
      rows.push({ type: "hour", hour: h });
    }
  }

  return (
    <div className="bg-surface dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 overflow-x-auto">
      <h3 className="text-sm font-medium mb-3">🕐 {diary.date} 24小时时间轴</h3>
      <div className="flex">
        <div className="flex-1 min-w-0">
          {rows.map((row, idx) => (
            <div key={idx} className="flex items-start">
              {/* 时间标签 */}
              <div className="shrink-0 w-12 text-right pr-2">
                <span className="text-xs text-gray-400 dark:text-slate-500 leading-none block" style={{ marginTop: row.type === "sleep" && row.sleepLabel ? 14 : 6 }}>
                  {row.type === "hour" ? `${row.hour}:00` : row.sleepLabel ? `${Math.floor(sleepEnd)}:00` : `${Math.floor(sleepStart)}:00`}
                </span>
              </div>

              {/* 内容 */}
              <div className="flex-1 relative border-l-2 border-gray-200 dark:border-slate-700" style={{ minHeight: row.type === "sleep" && row.sleepLabel ? sleepBlockH : hourHeight }}>
                <div className="absolute left-0 right-0 top-0 border-t border-dashed border-gray-100" style={{ display: row.type === "sleep" && !row.sleepLabel ? "none" : undefined }} />

                {row.type === "sleep" && row.sleepLabel ? (
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
                ) : row.type === "sleep" ? null : (
                  <div>
                    {/* 结束小时：先显示睡眠摘要，再显示标签事件 */}
                    {row.sleepLabel && (
                      <div className="mx-1 mt-1 mb-0 rounded-md px-2 py-0.5"
                        style={{ backgroundColor: "#818CF815", borderLeft: "3px solid #818CF8" }}>
                        <span className="text-[13px] font-medium text-[#6366F1]">{row.sleepLabel}</span>
                      </div>
                    )}
                    <div className="flex gap-1.5 py-1 pl-1">
                      {tagEvents
                      .filter(ev => {
                        if (ev.end !== undefined) {
                          return row.hour! >= Math.floor(ev.start) && row.hour! <= Math.floor(ev.end);
                        }
                        return Math.floor(ev.start) === row.hour;
                      })
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
  const [expanded, setExpanded] = useState(false);
  const heatmap = generateHeatmapData(diaries, year);
  // Build diary intensity map for consistent coloring
  const diaryMap = new Map(diaries.map(d => [d.date, d]));
  const intensityMap = new Map<string, number>();
  for (const d of heatmap) {
    const diary = diaryMap.get(d.date);
    const tagCount = diary?.tags?.length || 0;
    let level: number;
    if (tagCount === 0 && !diary?.wake_time && !diary?.sleep_time) level = 0;
    else if (tagCount <= 5) level = 1;
    else if (tagCount <= 10) level = 2;
    else if (tagCount <= 20) level = 3;
    else level = 4;
    intensityMap.set(d.date, level);
  }

  const INTENSITY_COLORS = ["#d1d5db", "#93c5fd", "#60a5fa", "#3b82f6", "#1e40af"];
  const weekDays = ["一","二","三","四","五","六","日"];
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentMonthRef = useRef<HTMLDivElement>(null);

  // Auto scroll to current month on mount with smooth animation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentMonthRef.current) {
        const container = scrollRef.current || currentMonthRef.current.closest('.overflow-x-auto') as HTMLElement;
        if (container) {
          const containerRect = container.getBoundingClientRect();
          const elementRect = currentMonthRef.current.getBoundingClientRect();
          container.scrollBy({
            left: elementRect.left - containerRect.left - (containerRect.width - elementRect.width) / 2,
            behavior: "smooth",
          });
        }
      }
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Build proper weekly grids per month (like calendar page)
  const months = Array.from({ length: 12 }, (_, mi) => {
    const ms = new Date(year, mi, 1);
    const me = new Date(year, mi + 1, 0);
    const cs = startOfWeek(ms, { weekStartsOn: 1 });
    const ce = endOfWeek(me, { weekStartsOn: 1 });
    const weeks: Date[][] = [];
    let cur = cs;
    while (cur.getTime() <= ce.getTime()) {
      const w: Date[] = [];
      for (let i = 0; i < 7; i++) { w.push(cur); cur = addDays(cur, 1); }
      weeks.push(w);
    }
    // Pad to 6 rows for alignment
    while (weeks.length < 6) {
      const w: Date[] = [];
      for (let i = 0; i < 7; i++) { w.push(new Date(NaN)); }
      weeks.push(w);
    }
    return { label: `${mi + 1}月`, monthIndex: mi, weeks };
  });

  return (
    <div className="bg-surface dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">🗓️ {year}年 活跃热力图</h3>
        <button onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors shrink-0 select-none">
          <svg className={`w-5 h-5 transition-transform duration-200 ${expanded ? "rotate-0" : "-rotate-90"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 10 12 16 18 10" />
          </svg>
        </button>
      </div>
      {expanded ? (
        <div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3 pb-3 border-b border-gray-100 dark:border-slate-700">
          {months.map((m) => {
            const isCurrent = m.monthIndex === new Date().getMonth();
            return (<div key={m.label} className={isCurrent ? "bg-blue-50/70 dark:bg-blue-900/15 ring-1 ring-blue-300 dark:ring-blue-700 rounded-lg p-2" : "p-2"}>
              <div className="text-[11px] font-semibold text-gray-600 dark:text-slate-300 mb-1.5 text-center select-none">{m.label}</div>
              {m.weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-[2px] mb-[2px]">
                  {week.map((day, di) => {
                    const isValid = !isNaN(day.getTime());
                    const inMonth = isValid && day.getMonth() === m.monthIndex;
                    const key = isValid ? formatDateFn(day, "yyyy-MM-dd") : `e-${wi}-${di}`;
                    const level = inMonth ? (intensityMap.get(key) ?? 0) : -1;
                    return (<div key={key} className="w-full aspect-square rounded-sm" style={{ backgroundColor: level >= 0 ? INTENSITY_COLORS[level] : "transparent" }} title={inMonth ? `${key}: ${intensityMap.has(key) ? "有日记" : "无"}` : ""} />);
                  })}
                </div>
              ))}
            </div>);
          })}
        </div>
        </div>
      ) : (
        <div ref={scrollRef} className="overflow-x-auto py-2 [&::-webkit-scrollbar]:h-1">
        <div className="flex w-fit">
          {months.map((m) => {
            const isCurrent = m.monthIndex === new Date().getMonth();
            return (<div key={m.label} ref={isCurrent ? currentMonthRef : null} className="shrink-0 w-[90px] md:w-[95px]">
              <div className={`p-1.5 rounded ${isCurrent ? "bg-blue-50/70 dark:bg-blue-900/15 ring-1 ring-blue-300 dark:ring-blue-700" : ""}`}>
                <div className="text-[9px] text-gray-400 dark:text-slate-500 mb-1 leading-none select-none text-left">{m.label}</div>
                {m.weeks.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 gap-[1px] mb-[1px]">
                    {week.map((day, di) => {
                      const isValid = !isNaN(day.getTime());
                      const inMonth = isValid && day.getMonth() === m.monthIndex;
                      const key = isValid ? formatDateFn(day, "yyyy-MM-dd") : `e-${wi}-${di}`;
                      const level = inMonth ? (intensityMap.get(key) ?? 0) : -1;
                      return (<div key={key} className="w-full aspect-square rounded-[2px]" style={{ backgroundColor: level >= 0 ? INTENSITY_COLORS[level] : "transparent" }} title={inMonth ? `${key}: ${intensityMap.has(key) ? "有日记" : "无"}` : ""} />);
                    })}
                  </div>
                ))}
              </div>
            </div>);
          })}
        </div>
        </div>
      )}
      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-100 dark:border-slate-700 text-[10px] text-gray-400 dark:text-slate-500">
        <span>少</span>
        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "#d1d5db" }} />
        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "#93c5fd" }} />
        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "#60a5fa" }} />
        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "#3b82f6" }} />
        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: "#1e40af" }} />
        <span>多</span>
        <span className="ml-auto">← 滑动 →</span>
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
  const [dateOffset, setDateOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(getTodayStr());

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth");
  }, [user, authLoading, router]);

  // 根据 range 和 offset 计算日期范围
  const { start, end, displayLabel } = useMemo(() => {
    let start = getTodayStr();
    let end = getTodayStr();
    let displayLabel = getTodayStr();

    switch (range) {
      case "today": {
        const d = new Date();
        d.setDate(d.getDate() + dateOffset);
        start = formatDateFn(d, "yyyy-MM-dd");
        end = start;
        displayLabel = start;
        // 扩大一天范围获取前一天的入睡时间
        const prev = new Date(d);
        prev.setDate(prev.getDate() - 1);
        start = formatDateFn(prev, "yyyy-MM-dd");
        break;
      }
      case "week": {
        const ref = new Date();
        ref.setDate(ref.getDate() + dateOffset * 7);
        const w = getWeekRange(ref);
        start = formatDateFn(w.start, "yyyy-MM-dd");
        end = formatDateFn(w.end, "yyyy-MM-dd");
        const weekNum = getISOWeek(w.start);
        displayLabel = `${formatDateFn(ref, "yyyy-MM")} 第${weekNum}周`;
        break;
      }
      case "month": {
        const ref = new Date();
        ref.setMonth(ref.getMonth() + dateOffset);
        const m = getMonthRange(ref);
        start = formatDateFn(m.start, "yyyy-MM-dd");
        end = formatDateFn(m.end, "yyyy-MM-dd");
        displayLabel = formatDateFn(ref, "yyyy-MM");
        break;
      }
      case "year": {
        const ref = new Date();
        ref.setFullYear(ref.getFullYear() + dateOffset);
        start = formatDateFn(startOfYear(ref), "yyyy-MM-dd");
        end = formatDateFn(endOfYear(ref), "yyyy-MM-dd");
        displayLabel = `${ref.getFullYear()}`;
        break;
      }
    }

    return { start, end, displayLabel };
  }, [range, dateOffset]);

  const { diaries, tagStats, sleepData, summary, loading } = useChartData(start, end);

  // 针对 "今天" 视图：tagStats 只算今天的日记（排除为了取入睡时间而多查的前一天）
  const effectiveTagStats = useMemo(() => {
    if (range !== "today") return tagStats;
    const todayDiaryForStats = diaries.filter(d => d.date === displayLabel);
    return aggregateTagStats(todayDiaryForStats, []);
  }, [range, diaries, displayLabel, tagStats]);

  const effectiveSleepData = useMemo(() => {
    if (range !== "today") return sleepData;
    return sleepData.filter(s => s.date === displayLabel);
  }, [range, sleepData, displayLabel]);

  // 自动选中第一天的日记（用于时间轴）
  useEffect(() => {
    if (diaries.length > 0 && !diaries.find(d => d.date === selectedDay)) {
      setSelectedDay(diaries[0].date);
    }
  }, [diaries, selectedDay]);

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
      const wk = Math.ceil(parseInt(d.date.slice(8)) / 7);
      weeks[`第${wk}周`] = (weeks[`第${wk}周`] || 0) + (d.tags?.length || 0);
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
      .map((s) => ({
        name: s.date.slice(5),
        hours: parseFloat(s.durationHours!.toFixed(1)),
      }));
  }, [sleepData, range]);

  // 本周起床柱状图
  const weekWakeChartData = useMemo(() => {
    if (range !== "week") return [];
    return sleepData
      .filter((s) => s.wakeTime)
      .map((s) => {
        const t = s.wakeTime!.includes("T") ? s.wakeTime!.split("T")[1].slice(0, 5) : s.wakeTime!;
        const [h, m] = t.split(":").map(Number);
        return {
          name: s.date.slice(5),
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

  const todayDiary = range === "today" ? diaries.find(d => d.date === displayLabel) || diaries[diaries.length - 1] : null;

  return (
    <div className="w-full max-w-full md:max-w-6xl mx-auto px-4 pt-0 pb-6 md:py-8 overflow-x-hidden">
      {/* 手机页头 */}
      <div className="lg:hidden mb-3 bg-surface dark:bg-slate-800 -mx-4 px-4 py-3">
        <div className="flex items-center justify-center gap-2">
          <span className="text-lg">📊</span>
          <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">图表分析</span>
        </div>
      </div>

      {/* Header + tabs */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="hidden lg:block text-2xl font-semibold shrink-0">📊 图表分析</h1>
        {/* 移动端上下排列：日期切换 + 标签 */}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-1">
        <div className="flex items-center gap-2">
          <button onClick={() => setDateOffset(o => o - 1)}
            className="w-7 h-7 flex items-center justify-center border border-gray-500 dark:border-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
            <svg className="w-4 h-4 text-gray-600 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="text-sm font-bold text-gray-700 dark:text-slate-200 min-w-[90px] md:min-w-[110px] text-center select-none">
            {displayLabel}
          </span>
          <button onClick={() => setDateOffset(o => o + 1)}
            className="w-7 h-7 flex items-center justify-center border border-gray-500 dark:border-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
            <svg className="w-4 h-4 text-gray-600 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
        <div className="flex gap-1.5 bg-gray-50 dark:bg-slate-800 rounded-lg p-1.5">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => { setRange(r); setDateOffset(0); setSelectedDay(getTodayStr()); }}
              className={`px-2.5 md:px-4 py-1.5 rounded-md text-xs md:text-sm font-medium transition-colors ${
                range === r
                  ? "bg-surface dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:text-slate-200"
              }`}
            >
              {{ today: "今天", week: "本周", month: "本月", year: "年度" }[r]}
            </button>
          ))}
        </div>
        </div>
      </div>

      {loading && (
        <div className="text-center py-20 text-gray-400 dark:text-slate-500">加载中...</div>
      )}

      {!loading && diaries.length === 0 && (
        <div className="text-center py-20 text-gray-400 dark:text-slate-500">
          <p className="text-lg mb-1">📭 暂无数据</p>
          <p className="text-sm">去写几篇日记再来看图表吧！</p>
        </div>
      )}

      {!loading && diaries.length > 0 && (
        <div className="space-y-6">
          {/* ---- TODAY ---- */}
          {range === "today" && todayDiary && (
            <>
              <Timeline24h diary={todayDiary} prevDiary={diaries.find(d => {
                const parts = displayLabel.split("-");
                const prev = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]) - 1);
                return d.date === formatDateFn(prev, "yyyy-MM-dd");
              })} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PieBlock title="今日标签占比" data={tagStatToPieData(effectiveTagStats)} />
                {summary && (
                  <div className="bg-surface dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
                    <h3 className="text-sm font-medium mb-3">📋 今日概况</h3>
                    <SummaryCard summary={summary} todayDiary={todayDiary} />
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
                    onClick={() => setSelectedDay(d.date)}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                      selectedDay === d.date
                        ? "bg-blue-500 text-white"
                        : "bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600"
                    }`}
                  >
                    {d.date.slice(5)}
                  </button>
                ))}
              </div>
              {selectedDay && (
                <Timeline24h diary={diaries.find((d) => d.date === selectedDay)}
                  prevDiary={diaries.find(d => {
                    const prev = new Date(selectedDay);
                    prev.setDate(prev.getDate() - 1);
                    return d.date === formatDateFn(prev, "yyyy-MM-dd");
                  })} />
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
                <div className="bg-surface dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
                  <h3 className="text-sm font-medium mb-3">🏆 本周活动排行</h3>
                  <HorizontalBar data={tagStats} />
                </div>
                {summary && (
                  <div className="bg-surface dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
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
                    onClick={() => setSelectedDay(d.date)}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                      selectedDay === d.date
                        ? "bg-blue-500 text-white"
                        : "bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600"
                    }`}
                  >
                    {d.date.slice(5)}
                  </button>
                ))}
              </div>
              {selectedDay && <Timeline24h diary={diaries.find((d) => d.date === selectedDay)} />}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PieBlock title="本月标签占比" data={tagStatToPieData(tagStats)} />
                {sleepDistData.length > 0 && <PieBlock title="入睡时间分布" data={sleepDistData} />}
              </div>

              <BarBlock title="每周活动趋势" data={weeklyBarData} />

              <LineBlock title="本月睡眠趋势 (小时)" data={sleepToBarData(sleepData).map((s: any) => ({ name: s.name, hours: s.hours }))} color="#6366F1" />

              {monthWakeBars.length > 0 && <BarBlock title="每日起床时间" data={monthWakeBars} color="#10B981" />}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-surface dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
                  <h3 className="text-sm font-medium mb-3">🏆 本月活动排行</h3>
                  <HorizontalBar data={tagStats} />
                </div>
                {summary && (
                  <div className="bg-surface dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
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
              <YearHeatmap key={`hm-${range}-${dateOffset}`} diaries={diaries} year={new Date().getFullYear()} />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PieBlock title="年度标签占比" data={tagStatToPieData(tagStats)} />
                {yearSleepDistData.length > 0 && <PieBlock title="年度入睡分布" data={yearSleepDistData} />}
              </div>

              {monthlyTagBarData.length > 0 && <BarBlock title="每月活动趋势" data={monthlyTagBarData} />}
              {yearSleepData.length > 0 && <LineBlock title="各月平均睡眠 (小时)" data={yearSleepData} color="#6366F1" />}
              {yearWakeBars.length > 0 && <BarBlock title="各月平均起床时间" data={yearWakeBars} color="#10B981" />}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-surface dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
                  <h3 className="text-sm font-medium mb-3">🏆 年度活动排行</h3>
                  <HorizontalBar data={tagStats} />
                </div>
                {summary && (
                  <div className="bg-surface dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
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
