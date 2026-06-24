"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Tag } from "@/types";

interface Props {
  tags: Tag[];
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onInsert: (newText: string) => void;
}

export default function TagPicker({ tags, textareaRef, onInsert }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [idx, setIdx] = useState(0);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [mode, setMode] = useState<"hash" | "time">("hash");
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = tags.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => setIdx(0), [query]);

  const check = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const cursorPos = el.selectionStart;
    const before = el.value.substring(0, cursorPos);

    // A: # 触发 → 弹框在 # 处
    const hash = before.lastIndexOf("#");
    if (hash !== -1) {
      const after = before.substring(hash + 1);
      if (!after.includes(" ") && !after.includes("\n")) {
        setQuery(after);
        setMode("hash");
        setPos(charPos(el, hash));
        setOpen(true);
        return;
      }
    }

    // B: 时间词触发 → 弹框在时间词末尾
    const tm = findLastTimeWord(before);
    if (tm) {
      const afterTime = before.substring(tm.end);
      if (/^\s*#/.test(afterTime)) { setOpen(false); return; }
      if ((afterTime.length <= 3 && !afterTime.includes("#")) || cursorPos === tm.end) {
        setQuery("");
        setMode("time");
        setPos(charPos(el, tm.end));
        setOpen(true);
        return;
      }
    }

    setOpen(false);
  }, [textareaRef]);

  const select = useCallback((name: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const cursorPos = el.selectionStart;
    const before = el.value.substring(0, cursorPos);
    const after = el.value.substring(cursorPos);
    let nv: string, nc: number;

    if (mode === "hash") {
      const hash = before.lastIndexOf("#");
      const pre = before.substring(0, hash);
      nv = pre + "#" + name + " ";
      nc = nv.length;
      let skip = after.length;
      const s1 = after.indexOf(" "), s2 = after.indexOf("\n");
      if (s1 !== -1) skip = s1;
      if (s2 !== -1) skip = Math.min(skip, s2);
      nv += after.substring(skip);
    } else {
      nv = before + "#" + name + " " + after;
      nc = before.length + name.length + 2;
    }

    onInsert(nv);
    setTimeout(() => { el.focus(); el.setSelectionRange(nc, nc); }, 0);
    setOpen(false);
  }, [textareaRef, onInsert, mode]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.addEventListener("input", check);
    el.addEventListener("compositionend", check);
    return () => {
      el.removeEventListener("input", check);
      el.removeEventListener("compositionend", check);
    };
  }, [check, textareaRef]);

  useEffect(() => {
    if (!open) return;
    function k(e: KeyboardEvent) {
      if (e.key === "ArrowDown") { e.preventDefault(); setIdx(p => Math.min(p + 1, filtered.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setIdx(p => Math.max(p - 1, 0)); }
      else if (e.key === "Enter" || e.key === "Tab") { if (filtered[idx]) { e.preventDefault(); select(filtered[idx].name); } }
      else if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open, filtered, idx, select]);

  useEffect(() => {
    if (!open) return;
    function c(e: MouseEvent) { if (listRef.current && !listRef.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", c);
    return () => document.removeEventListener("mousedown", c);
  }, [open]);

  if (!open || filtered.length === 0) return null;

  const el = (
    <div
      ref={listRef}
      className="fixed z-[9999] w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1"
      style={{ left: pos.x, top: pos.y }}
    >
      {filtered.map((t, i) => (
        <button
          key={t.id}
          type="button"
          onMouseDown={e => { e.preventDefault(); select(t.name); }}
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-blue-50 ${i===idx?"bg-blue-50":""}`}
        >
          <span className="w-3 h-3 rounded-full shrink-0" style={{background:t.color}}/>
          <span>#{t.name}</span>
        </button>
      ))}
    </div>
  );

  return createPortal(el, document.body);
}

// === 计算 textarea 中某个字符位置的屏幕坐标（视口坐标，供 fixed 用） ===
function charPos(el: HTMLTextAreaElement, charAt: number): { x: number; y: number } {
  const s = getComputedStyle(el);
  const er = el.getBoundingClientRect();

  // 构建 mirror 元素，复制 textarea 样式 + 内容
  const mirror = document.createElement("div");
  mirror.style.position = "fixed";
  mirror.style.left = `${er.left}px`;
  mirror.style.top = `${er.top}px`;
  mirror.style.width = `${el.clientWidth}px`;
  mirror.style.height = "auto";
  mirror.style.font = s.font;
  mirror.style.fontSize = s.fontSize;
  mirror.style.fontFamily = s.fontFamily;
  mirror.style.fontWeight = s.fontWeight;
  mirror.style.lineHeight = s.lineHeight;
  mirror.style.letterSpacing = s.letterSpacing;
  mirror.style.wordSpacing = s.wordSpacing;
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.padding = s.padding;
  mirror.style.paddingLeft = s.paddingLeft;
  mirror.style.paddingTop = s.paddingTop;
  mirror.style.paddingRight = s.paddingRight;
  mirror.style.paddingBottom = s.paddingBottom;
  mirror.style.border = s.border;
  mirror.style.borderLeftWidth = s.borderLeftWidth;
  mirror.style.borderTopWidth = s.borderTopWidth;
  mirror.style.boxSizing = s.boxSizing;

  // 前 charAt 个字符 + 标记 span
  const text = el.value;
  mirror.textContent = text.substring(0, charAt);
  const mark = document.createElement("span");
  mark.textContent = text.charAt(charAt) || ".";
  mirror.appendChild(mark);

  document.body.appendChild(mirror);
  const mk = mark.getBoundingClientRect();
  document.body.removeChild(mirror);

  const lh = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.4 || 20;

  // 返回视口坐标：text随 scroll 偏移，tag 框出现在字符下方
  return {
    x: mk.left,
    y: mk.top + lh + 4,
  };
}

// === 查找光标前最近的时间词 ===
function findLastTimeWord(text: string): { start: number; end: number } | null {
  const re = /(早上|上午|中午|下午|傍晚|晚上|凌晨|夜里|早晨)?\s*(\d{1,2})\s*[点:：]\s*(\d{0,2})\s*(?:分|半)?/g;
  const ms = [...text.matchAll(re)];
  if (!ms.length) return null;
  const last = ms[ms.length - 1];
  const end = (last.index ?? 0) + last[0].length;
  if (text.length - end > 5) return null;
  return { start: last.index ?? 0, end };
}
