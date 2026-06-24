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
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = tags.filter((t) =>
    t.name.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => setSelectedIdx(0), [query]);

  // 接收来自 textarea 的触发：用户输入了 #
  const triggerOpen = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;

    const pos = el.selectionStart;
    const textBefore = el.value.substring(0, pos);
    const hashIdx = textBefore.lastIndexOf("#");

    // # 后面不能有空格或换行
    const afterHash = textBefore.substring(hashIdx + 1);
    if (afterHash.includes(" ") || afterHash.includes("\n")) {
      setOpen(false);
      return;
    }

    setQuery(afterHash);

    // 计算浮动位置：基于 # 符号在 textarea 中的像素坐标
    const { x, y, height } = getTextareaCoordForPos(el, hashIdx);
    // 下拉框画在 textarea 视口之内，加 24px 的向下偏移
    const rect = el.getBoundingClientRect();
    setCoords({
      x: Math.min(x, rect.right - 200),   // 不超出右边
      y: y + height + 2,                   // 紧贴光标下方
    });
    setOpen(true);
  }, [textareaRef]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    function onInput() {
      const pos = el!.selectionStart;
      const textBefore = el!.value.substring(0, pos);
      const hashIdx = textBefore.lastIndexOf("#");
      if (hashIdx === -1 || hashIdx === pos - 1) {
        // 刚输入 #，或者后面有内容，触发
        if (hashIdx !== -1) {
          const after = textBefore.substring(hashIdx + 1);
          if (!after.includes(" ") && !after.includes("\n")) {
            triggerOpen();
            return;
          }
        }
        setOpen(false);
        return;
      }
      // 正在输入标签名，刷新过滤
      const after = textBefore.substring(hashIdx + 1);
      if (!after.includes(" ") && !after.includes("\n")) {
        setQuery(after);
        setOpen(true);
      } else {
        setOpen(false);
      }
    }

    el.addEventListener("input", onInput);
    return () => el.removeEventListener("input", onInput);
  }, [triggerOpen, textareaRef]);

  // 选中标签
  const selectTag = useCallback(
    (tagName: string) => {
      const el = textareaRef.current;
      if (!el) return;

      const pos = el.selectionStart;
      const textBefore = el.value.substring(0, pos);
      const textAfter = el.value.substring(pos);
      const hashIdx = textBefore.lastIndexOf("#");
      const before = el.value.substring(0, hashIdx);
      const replaced = before + `#${tagName} `;
      const newCursor = replaced.length;

      // 跳过标签名后面已输入的半截字符
      let skip = textAfter.length;
      const sp = textAfter.indexOf(" ");
      const nl = textAfter.indexOf("\n");
      if (sp !== -1) skip = sp;
      if (nl !== -1) skip = Math.min(skip, nl);

      onInsert(replaced + textAfter.substring(skip));
      setTimeout(() => {
        el.setSelectionRange(newCursor, newCursor);
        el.focus();
      }, 0);
      setOpen(false);
    },
    [textareaRef, onInsert]
  );

  // 键盘导航
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((p) => Math.min(p + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((p) => Math.max(p - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        if (filtered[selectedIdx]) {
          e.preventDefault();
          selectTag(filtered[selectedIdx].name);
        }
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, filtered, selectedIdx, selectTag]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!open || filtered.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="fixed z-[9999] w-52 bg-white border border-[var(--border)] rounded-xl shadow-lg py-1"
      style={{ left: coords.x, top: coords.y }}
    >
      {filtered.map((tag, idx) => (
        <button
          key={tag.id}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault(); // 抢在 textarea blur 之前
            selectTag(tag.name);
          }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left
            hover:bg-blue-50 transition-colors ${
              idx === selectedIdx ? "bg-blue-50" : ""
            }`}
        >
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: tag.color }}
          />
          <span>#{tag.name}</span>
        </button>
      ))}
    </div>
  );
}

// === 辅助：计算 textarea 中某个字符位置的像素坐标 ===
function getTextareaCoordForPos(
  el: HTMLTextAreaElement,
  pos: number
): { x: number; y: number; height: number } {
  const style = getComputedStyle(el);
  // 用 mirror div 测量
  const div = document.createElement("div");
  const copy = [
    "fontFamily", "fontSize", "fontWeight", "lineHeight",
    "letterSpacing", "wordSpacing", "textTransform", "whiteSpace",
    "paddingLeft", "paddingTop", "paddingRight", "paddingBottom",
    "borderLeftWidth", "borderTopWidth", "boxSizing",
  ];
  copy.forEach((p: string) => {
    const v = style.getPropertyValue(p);
    if (v) div.style.setProperty(p, v);
  });
  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.width = `${el.clientWidth}px`;
  div.style.whiteSpace = "pre-wrap";
  div.style.overflowWrap = "break-word";

  // 前 pos 个字符 + 一个 span 标记位置
  const before = el.value.substring(0, pos);
  const after = el.value.substring(pos) || ".";
  div.textContent = before;
  const mark = document.createElement("span");
  mark.textContent = after;
  div.appendChild(mark);

  document.body.appendChild(div);
  const divRect = div.getBoundingClientRect();
  const markRect = mark.getBoundingClientRect();
  document.body.removeChild(div);

  const elRect = el.getBoundingClientRect();
  return {
    x: elRect.left + (markRect.left - divRect.left),
    y: elRect.top + (markRect.top - divRect.top) - el.scrollTop,
    height: markRect.height,
  };
}
