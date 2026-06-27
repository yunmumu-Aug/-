"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useDiary, useTags } from "@/hooks/use-diary";
import { parseDiaryTags } from "@/lib/tag-parser";
import TagPicker from "@/components/diary/tag-picker";
import DateTimePicker from "@/components/diary/date-time-picker";
import { supabase } from "@/lib/supabase";
import type { Tag } from "@/types";
import {
  format as df, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths,
  isSameMonth, isSameDay, isToday,
} from "date-fns";
import { zhCN } from "date-fns/locale";

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getDefaultWake() { return `${getTodayStr()}T07:00`; }
function getDefaultSleep() { return `${getTodayStr()}T23:00`; }

function formatDisplayDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
}

// ── 迷你日历 ──
function MiniCalendar({ diaryDate, viewMonth, setViewMonth, diaryMap, onSelect }: {
  diaryDate: string; viewMonth: Date; setViewMonth: (d: Date) => void;
  diaryMap: Set<string>; onSelect: (d: string) => void;
}) {
  const grid = useMemo(() => {
    const ms = startOfMonth(viewMonth), me = endOfMonth(viewMonth);
    const cs = startOfWeek(ms, { weekStartsOn: 1 }), ce = endOfWeek(me, { weekStartsOn: 1 });
    const rows: Date[][] = [];
    let cur = cs;
    while (cur <= ce) { const w: Date[] = []; for (let i = 0; i < 7; i++) { w.push(cur); cur = addDays(cur, 1); } rows.push(w); }
    return rows;
  }, [viewMonth]);

  return (<div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/50 p-4">
    <div className="flex items-center justify-between mb-3">
      <button onClick={() => setViewMonth(subMonths(viewMonth, 1))} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">◀</button>
      <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">{df(viewMonth, "yyyy年 M月", { locale: zhCN })}</span>
      <button onClick={() => setViewMonth(addMonths(viewMonth, 1))} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">▶</button>
    </div>
    <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] text-gray-400 dark:text-slate-500 mb-1">
      {["一","二","三","四","五","六","日"].map(d => <div key={d}>{d}</div>)}
    </div>
    {grid.map((week, wi) => (
      <div key={wi} className="grid grid-cols-7 gap-0.5">
        {week.map(day => {
          const key = df(day, "yyyy-MM-dd");
          const selected = isSameDay(day, new Date(diaryDate));
          const today = isToday(day);
          const inMonth = isSameMonth(day, viewMonth);
          const hasDiary = diaryMap.has(key);
          return (
            <button key={key} onClick={() => onSelect(key)}
              className={`relative w-7 h-7 flex items-center justify-center rounded-full text-[10px] transition-colors
                ${!inMonth ? "text-gray-200 dark:text-slate-700" : ""}
                ${selected ? "bg-blue-500 text-white font-bold" : today ? "border border-blue-400 text-blue-600 dark:text-blue-400" : "hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300"}
              `}>
              {day.getDate()}
              {hasDiary && !selected && <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-blue-400" />}
            </button>
          );
        })}
      </div>
    ))}
  </div>);
}

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { saveDiary, getDiary, getDiaries, saving } = useDiary();
  const { getTags, createTag } = useTags();
  const router = useRouter();

  const [diaryDate, setDiaryDate] = useState(() => getTodayStr());
  const [wakeDatetime, setWakeDatetime] = useState(() => getDefaultWake());
  const [sleepDatetime, setSleepDatetime] = useState(() => getDefaultSleep());
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<Tag[]>([]);
  const [totalDiaries, setTotalDiaries] = useState(0);
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [diaryMap, setDiaryMap] = useState<Set<string>>(new Set());
  const [viewMonth, setViewMonth] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(new Date());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!authLoading && !user) router.replace("/auth"); }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    supabase.from("diaries").select("*", { count: "exact", head: true }).eq("user_id", user.id).then(({ count }) => setTotalDiaries(count || 0));
  }, [user]);

  useEffect(() => { if (user) getTags().then(setTags).catch(console.error); }, [user, getTags]);

  // 获取本月标签使用次数并排序
  const [tagUsage, setTagUsage] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    if (!user || tags.length === 0) return;
    const monthStart = df(startOfMonth(new Date()), "yyyy-MM-dd");
    const monthEnd = df(endOfMonth(new Date()), "yyyy-MM-dd");
    supabase.from("diaries").select("id").eq("user_id", user.id)
      .gte("date", monthStart).lte("date", monthEnd)
      .then(({ data: diaries }) => {
        if (!diaries || diaries.length === 0) { setTagUsage(new Map()); return; }
        const ids = diaries.map(d => d.id);
        return supabase.from("diary_tags").select("tag_id").in("diary_id", ids)
          .then(({ data }) => {
            const counts = new Map<string, number>();
            (data || []).forEach(dt => counts.set(dt.tag_id, (counts.get(dt.tag_id) || 0) + 1));
            setTagUsage(counts);
          });
      }).catch(() => {});
  }, [user, tags]);

  const sortedTags = useMemo(() => {
    return [...tags].sort((a, b) => (tagUsage.get(b.id) || 0) - (tagUsage.get(a.id) || 0));
  }, [tags, tagUsage]);

  // 加载当月有日记的日期
  const loadMonthDiaries = useCallback(async () => {
    if (!user) return;
    const start = df(startOfMonth(viewMonth), "yyyy-MM-dd");
    const end = df(endOfMonth(viewMonth), "yyyy-MM-dd");
    const list = await getDiaries(start, end);
    setDiaryMap(new Set(list.map(d => d.date)));
  }, [user, getDiaries, viewMonth]);

  useEffect(() => { loadMonthDiaries(); }, [loadMonthDiaries]);

  useEffect(() => {
    if (!user || diaryDate === loadedDate) return;
    let cancelled = false;
    getDiary(diaryDate).then(diary => {
      if (cancelled) return;
      if (diary) {
        setContent(diary.content || "");
        setWakeDatetime(diary.wake_time || `${diaryDate}T07:00`);
        setSleepDatetime(diary.sleep_time || `${diaryDate}T23:00`);
      } else { setContent(""); setWakeDatetime(`${diaryDate}T07:00`); setSleepDatetime(`${diaryDate}T23:00`); }
      setLoadedDate(diaryDate); setSaveMessage(null);
    }).catch(e => { if (!cancelled) { console.error(e); setSaveMessage("❌ 加载失败"); } });
    return () => { cancelled = true; };
  }, [diaryDate, user, getDiary, loadedDate]);

  // 日期选择器点击外部关闭
  useEffect(() => {
    if (!showDatePicker) return;
    const handler = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) setShowDatePicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDatePicker]);

  const parsedTags = useMemo(() => parseDiaryTags(content), [content]);
  const todayEventCount = parsedTags.filter(p => p.timeStr).length;
  const todayTagCount = parsedTags.length;

  // 快捷标签（当前日记使用的标签 + 颜色）
  const recentQuickTags = useMemo(() => {
    const parsed = [...content.matchAll(/#([\w一-鿿가-퟿぀-ヿ]+)/g)].map(m => m[1]);
    const names = new Set(parsed);
    return tags.filter(t => names.has(t.name)).slice(0, 6);
  }, [tags, content]);

  function insertQuickTag(name: string) {
    const el = textareaRef.current;
    if (!el) { setContent(content + `#${name} `); return; }
    const pos = el.selectionStart;
    const before = content.substring(0, pos);
    const after = content.substring(pos);
    const nv = before + `#${name} ` + after;
    setContent(nv);
    setTimeout(() => { el.focus(); el.setSelectionRange(pos + name.length + 2, pos + name.length + 2); }, 0);
  }

  async function handleSave() {
    if (!user) return; setSaveMessage(null);
    try {
      const tagNameSet = new Set(parsedTags.map(p => p.tagName));
      const em = new Map(tags.map(t => [t.name, t]));
      const idm = new Map(tags.map(t => [t.name, t.id]));
      for (const tn of tagNameSet) { if (!em.has(tn)) { try { const nt = await createTag(tn); if (nt) idm.set(tn, nt.id); } catch {} } }
      const updated = await getTags();
      const fm = new Map(updated.map(t => [t.name, t.id]));
      const dt = parsedTags.filter(p => fm.has(p.tagName)).map(p => ({ tagId: fm.get(p.tagName)!, timeLabel: p.timeStr }));
      await saveDiary({ date: diaryDate, content, wakeTime: wakeDatetime, sleepTime: sleepDatetime, tags: dt });
      setTags(updated); setSaveMessage("✅ 保存成功"); setTimeout(() => setSaveMessage(null), 2000);
      loadMonthDiaries();
    } catch (e: any) { setSaveMessage(`❌ ${e.message || "保存失败"}`); }
  }

  if (authLoading) return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-500 dark:text-slate-400">加载中...</p></div>;
  if (!user) return null;

  return (
    <div className="w-full max-w-5xl mx-auto px-0 sm:px-4 md:px-6 pt-0 pb-3 sm:py-6">
      <div className="flex gap-6">

        {/* ═══ 左侧栏 ═══ */}
        <aside className="hidden lg:block lg:w-60 shrink-0 space-y-4">

          {/* 统计 */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/50 p-4">
            <h3 className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-3">📊 数据统计</h3>
            <div className="space-y-2">
              {[{ label: "笔记总数", val: totalDiaries }, { label: "标签总数", val: tags.length }, { label: "本月记录", val: diaryMap.size }].map(({ label, val }) => (
                <div key={label} className="flex items-center justify-between py-1.5 px-3 bg-gray-50 dark:bg-slate-800/80 rounded-lg">
                  <span className="text-xs text-gray-500 dark:text-slate-400">{label}</span>
                  <span className="text-sm font-bold text-gray-800 dark:text-slate-100">{val || "-"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 迷你日历 */}
          <MiniCalendar diaryDate={diaryDate} viewMonth={viewMonth} setViewMonth={setViewMonth} diaryMap={diaryMap} onSelect={setDiaryDate} />

          {/* 快捷标签 */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/50 p-4">
            <h3 className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-3">⚡ 快捷标签</h3>
            <div className="flex flex-wrap gap-1.5">
              {recentQuickTags.length > 0
                ? recentQuickTags.map(t => (
                  <button key={t.id} onClick={() => insertQuickTag(t.name)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors"
                    style={{ backgroundColor: t.color + "18", color: t.color, border: `1px solid ${t.color}40` }}>
                    #{t.name}
                  </button>
                ))
                : <p className="text-[11px] text-gray-400 dark:text-slate-500">写日记识别标签后这里会出现快捷入口</p>}
            </div>
          </div>
        </aside>

        {/* ═══ 右侧主内容 ═══ */}
        <div className="flex-1 min-w-0">

          {/* 手机页头 */}
          <div className="lg:hidden mb-3 bg-white dark:bg-slate-800 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">⏳</span>
              <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">时光轴 — 日记分析</span>
            </div>
          </div>

          {/* 手机统计 */}
          <div className="grid grid-cols-3 gap-2 mb-4 lg:hidden mx-4 sm:mx-0">
            {[{ label: "笔记总数", val: totalDiaries }, { label: "标签总数", val: tags.length }, { label: "本月记录", val: diaryMap.size }].map(({ label, val }) => (
              <div key={label} className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700/50 text-center">
                <div className="text-base font-bold text-gray-800 dark:text-slate-100">{val || "-"}</div>
                <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {/* 右侧白色卡片区：标题 → 标签预览 */}
          <div className="bg-white dark:bg-slate-800 rounded-none sm:rounded-2xl border-0 sm:border sm:border-gray-100 dark:sm:border-slate-700/50 p-4 md:p-6">

            {/* 标题 */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-gray-800 dark:text-slate-100 whitespace-nowrap">📝 写日记</h1>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{formatDisplayDate(diaryDate)}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => { const d = new Date(diaryDate); d.setDate(d.getDate()-1); setDiaryDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`); }}
                  className="w-7 h-7 flex items-center justify-center border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                  <svg className="w-4 h-4 text-gray-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <button onClick={() => { setPickerMonth(new Date(diaryDate)); setShowDatePicker(v => !v); }}
                  className="text-sm font-bold text-gray-700 dark:text-slate-200 min-w-[80px] text-center select-none bg-gray-100 dark:bg-slate-700 rounded-lg px-2 py-1.5 cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors">{diaryDate.slice(5)}</button>
                <button onClick={() => { const d = new Date(diaryDate); d.setDate(d.getDate()+1); setDiaryDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`); }}
                  className="w-7 h-7 flex items-center justify-center border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                  <svg className="w-4 h-4 text-gray-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            {showDatePicker && createPortal(
              <div className="fixed inset-0 z-[9998] flex items-center justify-center cursor-default" onClick={() => setShowDatePicker(false)}>
                <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" />
                <div ref={datePickerRef} onClick={e => e.stopPropagation()}
                  className="relative z-[9999] bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-lg p-3" style={{ width: 260 }}>
                  <div className="text-center py-1 text-xs font-semibold text-gray-400 dark:text-slate-500 select-none">
                    {pickerMonth.getFullYear()}-{String(pickerMonth.getMonth() + 1).padStart(2, "0")}
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <button onClick={() => setPickerMonth(subMonths(pickerMonth, 1))} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-xs">◀</button>
                    <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">{df(pickerMonth, "M月", { locale: zhCN })}</span>
                    <button onClick={() => setPickerMonth(addMonths(pickerMonth, 1))} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-xs">▶</button>
                  </div>
                  <div className="grid grid-cols-7 gap-0 text-center text-[10px] text-gray-400 dark:text-slate-500 mb-0.5">
                    {["一","二","三","四","五","六","日"].map(d => <div key={d}>{d}</div>)}
                  </div>
                  <div className="border-t border-gray-100 dark:border-slate-700 pt-2 mt-1">
                  {(() => {
                    const ms = startOfMonth(pickerMonth), me = endOfMonth(pickerMonth);
                    const cs = startOfWeek(ms, { weekStartsOn: 1 }), ce = endOfWeek(me, { weekStartsOn: 1 });
                    const rows: Date[][] = [];
                    let cur = cs;
                    while (cur <= ce) { const w: Date[] = []; for (let i = 0; i < 7; i++) { w.push(cur); cur = addDays(cur, 1); } rows.push(w); }
                    return rows.map((week, wi) => (
                      <div key={wi} className="grid grid-cols-7 gap-0">
                        {week.map(day => {
                          const k = df(day, "yyyy-MM-dd");
                          const sel = k === diaryDate;
                          const inMonth = isSameMonth(day, pickerMonth);
                          const hasDiary = diaryMap.has(k);
                          return (
                            <button key={k} type="button" onClick={() => { setDiaryDate(k); setShowDatePicker(false); }}
                              className={`relative w-8 h-8 flex items-center justify-center rounded-full text-xs transition-colors
                                ${!inMonth ? "text-gray-200 dark:text-slate-700" : ""}
                                ${sel ? "bg-blue-500 text-white font-bold" : inMonth ? "hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300" : ""}
                                ${isToday(day) && !sel ? "border border-blue-400 text-blue-600 dark:text-blue-400" : ""}
                              `}>{day.getDate()}
                              {hasDiary && inMonth && !sel && <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-blue-500 dark:bg-blue-400" />}
                            </button>
                          );
                        })}
                      </div>
                    ));
                  })()}
                  </div>
                </div>
              </div>, document.body
            )}
          </div>

            {/* 起床 / 入睡 */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-700">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-gray-200 dark:bg-slate-600 flex items-center justify-center text-sm shrink-0">⏰</span>
                    <span className="text-xs font-medium text-gray-500 dark:text-slate-400 shrink-0">起床时间</span>
                  </div>
                  <DateTimePicker value={wakeDatetime} onChange={setWakeDatetime} />
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-gray-50 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-700">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-gray-200 dark:bg-slate-600 flex items-center justify-center text-sm shrink-0">🌙</span>
                    <span className="text-xs font-medium text-gray-500 dark:text-slate-400 shrink-0">入睡时间</span>
                  </div>
                  <DateTimePicker value={sleepDatetime} onChange={setSleepDatetime} />
                </div>
              </div>
            </div>

            {/* 正文 */}
            <div className="relative mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-400 dark:text-slate-500">📝 日记内容</span>
                <span className="text-[10px] text-gray-300 dark:text-slate-500">{content.length} 字</span>
              </div>
              <textarea ref={textareaRef} rows={11} value={content} onChange={e => setContent(e.target.value)}
                placeholder="今天发生了什么..."
                className="w-full px-4 py-3.5 bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-700 rounded-2xl text-sm leading-relaxed resize-none
                  focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400
                  placeholder:text-gray-300 dark:placeholder:text-slate-500 transition-shadow hover:shadow-sm" />
              <TagPicker tags={sortedTags} tagUsage={tagUsage} textareaRef={textareaRef} onInsert={setContent} />
            </div>

            {/* 标签预览 */}
            <div className="flex flex-wrap items-center gap-1.5 mb-2 min-h-[32px] p-2.5 bg-gray-50/50 dark:bg-slate-700/30 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
              <span className="text-[10px] text-gray-400 dark:text-slate-500 mr-1">🏷️</span>
              {parsedTags.length > 0
                ? parsedTags.map((pt, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30">
                    #{pt.tagName}{pt.timeStr && <span className="opacity-40 text-[10px]">{pt.timeStr}</span>}
                  </span>))
                : <span className="text-[11px] text-gray-400 dark:text-slate-500">输入 # 弹出标签选择，时间词自动关联</span>}
            </div>

            {/* 手机端快捷标签 */}
            <div className="lg:hidden mb-4">
              <div className="flex flex-wrap gap-1.5">
                {recentQuickTags.length > 0 && <span className="text-[10px] text-gray-400 dark:text-slate-500 self-center mr-1">⚡</span>}
                {recentQuickTags.map(t => (
                  <button key={t.id} onClick={() => insertQuickTag(t.name)}
                    className="px-2 py-1 rounded-full text-[10px] transition-colors"
                    style={{ backgroundColor: t.color + "18", color: t.color, border: `1px solid ${t.color}40` }}>
                    +#{t.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 按钮 */}
            <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-gray-100 dark:border-slate-700">
              <div>{saveMessage && <span className={`text-xs font-medium ${saveMessage.startsWith("✅") ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>{saveMessage}</span>}</div>
              <div className="flex gap-2">
                <button onClick={() => { localStorage.setItem(`draft-${diaryDate}`, content); setSaveMessage("✅ 草稿已暂存"); setTimeout(() => setSaveMessage(null), 1800); }}
                  className="px-4 py-2 border border-gray-200 dark:border-slate-700 text-xs font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 active:scale-[0.98] transition-all text-gray-500 dark:text-slate-400">暂存</button>
                <button onClick={handleSave} disabled={saving}
                  className="px-6 py-2 bg-blue-500 dark:bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-600 dark:hover:bg-blue-500 active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm shadow-blue-500/20">
                  {saving ? "保存中..." : "保存日记"}
                </button>
              </div>
            </div>
          </div>
          {/* ═══ 右侧白色卡片结束 ═══ */}

        </div>
      </div>
    </div>
  );
}
