"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { format as df, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addMonths, subMonths, isSameDay, isToday, isSameMonth } from "date-fns";
import { zhCN } from "date-fns/locale";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function DateTimePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(new Date());
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const hourRef = useRef<HTMLDivElement>(null);
  const minuteRef = useRef<HTMLDivElement>(null);

  const date = value ? new Date(value) : new Date();
  const dateStr = isNaN(date.getTime()) ? df(new Date(), "yyyy-MM-dd") : df(date, "yyyy-MM-dd");
  const hour = date.getHours();
  const minute = date.getMinutes();

  const grid = (() => {
    const ms = startOfMonth(viewMonth), me = endOfMonth(viewMonth);
    const cs = startOfWeek(ms, { weekStartsOn: 1 }), ce = endOfWeek(me, { weekStartsOn: 1 });
    const rows: Date[][] = [];
    let cur = cs;
    while (cur <= ce) { const w: Date[] = []; for (let i = 0; i < 7; i++) { w.push(cur); cur = addDays(cur, 1); } rows.push(w); }
    return rows;
  })();

  function selectDate(d: Date) {
    const ds = df(d, "yyyy-MM-dd");
    onChange(`${ds}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  }

  function selectTime(h: number, m: number) {
    onChange(`${dateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current?.contains(e.target as Node) ||
        popupRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        if (hourRef.current) hourRef.current.scrollTop = Math.max(0, (hour - 2) * 28);
        if (minuteRef.current) minuteRef.current.scrollTop = Math.max(0, (minute / 5 - 2) * 28);
      }, 50);
    }
  }, [open, hour, minute]);

  function handleToggle() {
    if (open) { setOpen(false); return; }
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const popupWidth = 300;
      const popupHeight = 260;
      const vpCenter = window.innerWidth / 2;
      const inputCenter = rect.left + rect.width / 2;

      let left: number;
      if (inputCenter < vpCenter) {
        // 左侧 → 弹出框左边对齐输入框左边
        left = rect.left;
        if (left + popupWidth > window.innerWidth - 8) {
          left = window.innerWidth - popupWidth - 8;
        }
      } else {
        // 右侧 → 弹出框右边对齐输入框右边
        left = rect.right - popupWidth;
      }
      if (left < 8) left = 8;

      let top = rect.bottom + 4;
      if (top + popupHeight > window.innerHeight) {
        top = Math.max(8, rect.top - popupHeight - 4);
      }
      setPopupStyle({ position: "fixed", top, left, zIndex: 9999 });
    }
    setOpen(true);
  }

  const displayValue = `${dateStr.slice(5)} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  return (
    <div ref={containerRef}>
      <input type="text" readOnly value={displayValue}
        onClick={handleToggle}
        className="w-full px-2 py-1.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl text-xs text-center cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-blue-400/50" />

      {open && createPortal(
        <div ref={popupRef} style={popupStyle}
          className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-lg p-3 max-w-[90vw]">
          <div className="flex gap-2 md:gap-3">

            {/* 左：日历 */}
            <div className="w-[180px] md:w-[200px] shrink-0">
              <div className="flex items-center justify-between mb-2">
                <button onClick={() => setViewMonth(subMonths(viewMonth, 1))} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 p-0.5">◀</button>
                <span className="text-xs font-semibold text-gray-600 dark:text-slate-300">{df(viewMonth, "M月", { locale: zhCN })}</span>
                <button onClick={() => setViewMonth(addMonths(viewMonth, 1))} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 p-0.5">▶</button>
              </div>
              <div className="grid grid-cols-7 gap-0 text-center text-[10px] text-gray-400 dark:text-slate-500 mb-0.5">
                {["一","二","三","四","五","六","日"].map(d => <div key={d}>{d}</div>)}
              </div>
              {grid.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-0">
                  {week.map(day => {
                    const key = df(day, "yyyy-MM-dd");
                    const selected = isSameDay(day, date);
                    const today = isToday(day);
                    const inMonth = isSameMonth(day, viewMonth);
                    return (
                      <button key={key} type="button" onClick={() => selectDate(day)}
                        className={`w-7 h-7 flex items-center justify-center rounded-full text-[11px] transition-colors
                          ${!inMonth ? "text-gray-200 dark:text-slate-700" : ""}
                          ${selected ? "bg-blue-500 text-white font-bold" : today ? "border border-blue-400 text-blue-600" : "hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300"}
                        `}>{day.getDate()}</button>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* 分割线 */}
            <div className="w-px bg-gray-200 dark:bg-slate-700 self-stretch shrink-0" />

            {/* 右：时间 */}
            <div className="flex gap-1.5 shrink-0">
              <div className="text-center">
                <div className="text-[10px] text-gray-400 dark:text-slate-500 mb-1">时</div>
                <div ref={hourRef} className="h-[168px] w-8 md:w-9 overflow-y-auto space-y-0.5 [&::-webkit-scrollbar]:hidden">
                  {Array.from({ length: 24 }, (_, i) => (
                    <button key={i} type="button" onClick={() => selectTime(i, minute)}
                      className={`w-full py-1 rounded-lg text-xs transition-colors ${hour === i ? "bg-blue-500 text-white font-medium" : "text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700"}`}>
                      {String(i).padStart(2, "0")}
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-gray-400 dark:text-slate-500 mb-1">分</div>
                <div ref={minuteRef} className="h-[168px] w-8 md:w-9 overflow-y-auto space-y-0.5 [&::-webkit-scrollbar]:hidden">
                  {Array.from({ length: 12 }, (_, i) => i * 5).map(m => (
                    <button key={m} type="button" onClick={() => selectTime(hour, m)}
                      className={`w-full py-1 rounded-lg text-xs transition-colors ${minute === m ? "bg-blue-500 text-white font-medium" : "text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700"}`}>
                      {String(m).padStart(2, "0")}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
