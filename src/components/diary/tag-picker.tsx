"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
  const [pt, setPt] = useState({ x: 0, y: 0 });
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = tags.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => setIdx(0), [query]);

  const check = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart;
    const before = el.value.substring(0, pos);
    const hash = before.lastIndexOf("#");
    if (hash === -1) { setOpen(false); return; }
    const after = before.substring(hash + 1);
    if (after.includes(" ") || after.includes("\n")) { setOpen(false); return; }

    setQuery(after);

    // 用 mirror div 计算 # 的屏幕坐标
    const mt = mirrorGetRect(el, hash);
    setPt({ x: mt.x, y: mt.y + mt.h + 4 });
    setOpen(true);
  }, [textareaRef]);

  const select = useCallback((name: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart;
    const before = el.value.substring(0, pos);
    const after = el.value.substring(pos);
    const hash = before.lastIndexOf("#");
    let nv: string, nc: number;

    if (hash !== -1 && !before.substring(hash + 1).includes(" ") && !before.substring(hash + 1).includes("\n")) {
      const pre = el.value.substring(0, hash);
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
  }, [textareaRef, onInsert]);

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

  return (
    <div
      ref={listRef}
      className="fixed z-[9999] w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1"
      style={{ left: pt.x, top: pt.y }}
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
}

// === 精确计算 textarea 中某个字符位置的屏幕坐标 ===
function mirrorGetRect(el: HTMLTextAreaElement, pos: number): { x: number; y: number; h: number } {
  const style = getComputedStyle(el);
  // 用 span 的方法：创建 mirror，前 pos 个字符 + marker span
  const mirror = document.createElement("div");
  mirror.style.position = "fixed";
  mirror.style.left = "-9999px";
  mirror.style.top = "0";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.font = style.font;
  mirror.style.fontSize = style.fontSize;
  mirror.style.fontFamily = style.fontFamily;
  mirror.style.fontWeight = style.fontWeight;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.wordSpacing = style.wordSpacing;
  mirror.style.textTransform = style.textTransform;
  mirror.style.width = el.clientWidth + "px";
  mirror.style.padding = style.padding;
  mirror.style.paddingLeft = style.paddingLeft;
  mirror.style.paddingTop = style.paddingTop;
  mirror.style.paddingRight = style.paddingRight;
  mirror.style.paddingBottom = style.paddingBottom;
  mirror.style.border = style.border;
  mirror.style.borderLeftWidth = style.borderLeftWidth;
  mirror.style.borderTopWidth = style.borderTopWidth;
  mirror.style.boxSizing = style.boxSizing;

  // 前 pos 个字符 + marker
  const text = el.value;
  mirror.textContent = text.substring(0, pos);
  const marker = document.createElement("span");
  marker.textContent = text.charAt(pos) || ".";
  mirror.appendChild(marker);

  document.body.appendChild(mirror);
  const mr = marker.getBoundingClientRect();
  document.body.removeChild(mirror);

  return { x: mr.left, y: mr.top, h: mr.height };
}
