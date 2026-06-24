"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Tag } from "@/types";

interface Props {
  tags: Tag[];
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onInsert: (newText: string) => void;
}

function getCoords(el: HTMLTextAreaElement, pos: number) {
  const div = document.createElement("div");
  const style = getComputedStyle(el);
  ["fontFamily","fontSize","fontWeight","lineHeight","letterSpacing","wordSpacing","textTransform","whiteSpace","paddingLeft","paddingTop","paddingRight","paddingBottom","borderLeftWidth","borderTopWidth"].forEach((p) => {
    div.style[p as any] = style[p as any];
  });
  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.width = el.clientWidth + "px";
  div.style.whiteSpace = "pre-wrap";
  div.style.overflowWrap = "break-word";
  div.textContent = el.value.substring(0, pos) + ".";
  document.body.appendChild(div);
  const r = div.getBoundingClientRect();
  document.body.removeChild(div);
  const er = el.getBoundingClientRect();
  return { x: r.left, y: er.top + (r.top - er.top) - el.scrollTop, h: r.height };
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

    // # 触发
    const hash = before.lastIndexOf("#");
    if (hash !== -1) {
      const after = before.substring(hash + 1);
      if (!after.includes(" ") && !after.includes("\n")) {
        setQuery(after);
        const c = getCoords(el, hash);
        setPt({ x: Math.min(c.x, el.getBoundingClientRect().right - 200), y: c.y + c.h + 4 });
        setOpen(true);
        return;
      }
    }
    setOpen(false);
  }, [textareaRef]);

  // selectTag
  const select = useCallback((name: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart;
    const before = el.value.substring(0, pos);
    const after = el.value.substring(pos);
    const hash = before.lastIndexOf("#");
    let nv: string, nc: number;

    if (hash !== -1 && !before.substring(hash + 1).includes(" ") && !before.substring(hash + 1).includes("\n")) {
      nv = el.value.substring(0, hash) + "#" + name + " ";
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

  // 事件绑定
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

  // 键盘
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

  // 外部点击
  useEffect(() => {
    if (!open) return;
    function c(e: MouseEvent) { if (listRef.current && !listRef.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", c);
    return () => document.removeEventListener("mousedown", c);
  }, [open]);

  if (!open || filtered.length === 0) return null;

  return (
    <div ref={listRef} className="fixed z-[9999] w-48 bg-white border border-[var(--border)] rounded-xl shadow-lg py-1" style={{ left: pt.x, top: pt.y }}>
      {filtered.map((t, i) => (
        <button key={t.id} type="button" onMouseDown={e => { e.preventDefault(); select(t.name); }}
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-blue-50 ${i===idx?"bg-blue-50":""}`}>
          <span className="w-3 h-3 rounded-full shrink-0" style={{background:t.color}}/>
          <span>#{t.name}</span>
        </button>
      ))}
    </div>
  );
}
