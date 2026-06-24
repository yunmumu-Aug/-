"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Tag } from "@/types";

interface Props {
  tags: Tag[];
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onInsert: (newText: string) => void;
}

// === 查找光标前最近的时间词 ===
function findLastTimeWord(text: string): { start: number; end: number } | null {
  // 用 matchAll 避免 lastIndex 残留
  const regex = /(早上|上午|中午|下午|傍晚|晚上|凌晨|夜里|早晨)?\s*(\d{1,2})\s*[点:：]\s*(\d{0,2})\s*(?:分|半)?/g;
  const matches = [...text.matchAll(regex)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  const matchEnd = (last.index ?? 0) + last[0].length;
  if (text.length - matchEnd > 3) return null; // 时间词离光标不能超过3个字符
  return { start: last.index ?? 0, end: matchEnd };
}

// === 计算 textarea 中字符位置 ===
function getCoords(el: HTMLTextAreaElement, pos: number) {
  const style = getComputedStyle(el);
  const div = document.createElement("div");
  ["fontFamily","fontSize","fontWeight","lineHeight","letterSpacing","wordSpacing","textTransform","whiteSpace","paddingLeft","paddingTop","paddingRight","paddingBottom","borderLeftWidth","borderTopWidth","boxSizing"].forEach((p) => {
    const v = style.getPropertyValue(p);
    if (v) div.style.setProperty(p, v);
  });
  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.width = `${el.clientWidth}px`;
  div.style.whiteSpace = "pre-wrap";
  div.style.overflowWrap = "break-word";
  div.textContent = el.value.substring(0, pos);
  const mark = document.createElement("span");
  mark.textContent = el.value.substring(pos) || ".";
  div.appendChild(mark);
  document.body.appendChild(div);
  const mr = mark.getBoundingClientRect();
  const er = el.getBoundingClientRect();
  document.body.removeChild(div);
  return { x: er.left + (mr.left - er.left), y: er.top + (mr.top - er.top) - el.scrollTop, h: mr.height };
}

export default function TagPicker({ tags, textareaRef, onInsert }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [idx, setIdx] = useState(0);
  const [pt, setPt] = useState({ x: 0, y: 0 });
  const listRef = useRef<HTMLDivElement>(null);
  // 用 ref 保持最新函数引用，避免闭包过期
  const onInsertRef = useRef(onInsert);
  onInsertRef.current = onInsert;
  const openRef = useRef(open);
  openRef.current = open;
  const idxRef = useRef(idx);
  idxRef.current = idx;

  const filtered = tags.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => setIdx(0), [query]);

  // 核心：input 事件处理
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    function handler() {
      const pos = el!.selectionStart;
      const before = el!.value.substring(0, pos);
      const lastChar = before.slice(-1);

      // A: # 触发
      const hash = before.lastIndexOf("#");
      if (hash !== -1) {
        const after = before.substring(hash + 1);
        if (!after.includes(" ") && !after.includes("\n")) {
          setQuery(after);
          const c = getCoords(el!, hash);
          const rect = el!.getBoundingClientRect();
          setPt({ x: Math.min(c.x, rect.right - 210), y: c.y + c.h + 2 });
          setOpen(true);
          return;
        }
      }

      // B: 时间词触发
      const tm = findLastTimeWord(before);
      if (tm) {
        const afterTime = before.substring(tm.end);
        // 后面已经跟了 # → 让 A 处理
        if (afterTime.startsWith("#") || /^\s*#/.test(afterTime)) { setOpen(false); return; }
        // 时间词后最多 3 个非 # 字符，或刚好在时间词末尾
        if ((afterTime.length <= 3 && !afterTime.includes("#")) || pos === tm.end) {
          setQuery("");
          const c = getCoords(el!, Math.min(tm.end, pos));
          const rect = el!.getBoundingClientRect();
          setPt({ x: Math.min(c.x, rect.right - 210), y: c.y + c.h + 2 });
          setOpen(true);
          return;
        }
      }

      setOpen(false);
    }

    el.addEventListener("input", handler);
    return () => el.removeEventListener("input", handler);
  }, [textareaRef]);

  // 选中
  const select = useCallback((name: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart;
    const b = el.value.substring(0, pos);
    const a = el.value.substring(pos);
    const hash = b.lastIndexOf("#");
    let nv: string, nc: number;

    if (hash !== -1 && !b.substring(hash + 1).includes(" ") && !b.substring(hash + 1).includes("\n")) {
      const pre = el.value.substring(0, hash);
      nv = pre + `#${name} `;
      nc = nv.length;
      let skip = a.length;
      const s1 = a.indexOf(" "); const s2 = a.indexOf("\n");
      if (s1 !== -1) skip = s1;
      if (s2 !== -1) skip = Math.min(skip, s2);
      nv += a.substring(skip);
    } else {
      nv = b + `#${name} ` + a;
      nc = b.length + name.length + 2;
    }
    onInsertRef.current(nv);
    setTimeout(() => { el.setSelectionRange(nc, nc); el.focus(); }, 0);
    setOpen(false);
  }, [textareaRef]);

  // 键盘
  useEffect(() => {
    if (!open) return;
    const f = filtered;
    function k(e: KeyboardEvent) {
      if (e.key === "ArrowDown") { e.preventDefault(); setIdx((p) => Math.min(p + 1, f.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((p) => Math.max(p - 1, 0)); }
      else if (e.key === "Enter" || e.key === "Tab") {
        if (f[idxRef.current]) { e.preventDefault(); select(f[idxRef.current].name); }
      }
      else if (e.key === "Escape") { setOpen(false); }
    }
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open, filtered, select]);

  // 外部点击关闭
  useEffect(() => {
    if (!open) return;
    function c(e: MouseEvent) { if (listRef.current && !listRef.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", c);
    return () => document.removeEventListener("mousedown", c);
  }, [open]);

  if (!open || filtered.length === 0) return null;

  return (
    <div ref={listRef} className="fixed z-[9999] w-52 bg-white border border-[var(--border)] rounded-xl shadow-lg py-1" style={{ left: pt.x, top: pt.y }}>
      <div className="px-3 py-1 text-[10px] text-[var(--text-muted)]">↑↓选择 Enter确认 Esc关闭</div>
      {filtered.map((t, i) => (
        <button
          key={t.id}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); select(t.name); }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-blue-50 transition-colors ${i === idx ? "bg-blue-50" : ""}`}
        >
          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
          <span>#{t.name}</span>
        </button>
      ))}
    </div>
  );
}
