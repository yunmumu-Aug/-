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

  // 检查光标前文本，判断是否触发
  function checkTrigger() {
    const el = textareaRef.current;
    if (!el) return;

    const pos = el.selectionStart;
    const textBefore = el.value.substring(0, pos);
    const lastChar = textBefore.slice(-1);

    // 方式 A：输入 # → 弹出
    const hashIdx = textBefore.lastIndexOf("#");
    if (hashIdx !== -1) {
      const afterHash = textBefore.substring(hashIdx + 1);
      if (!afterHash.includes(" ") && !afterHash.includes("\n")) {
        setQuery(afterHash);
        showAtPos(el, hashIdx);
        return;
      }
    }

    // 方式 B：最近打了时间词，后面还没跟 #标签 → 也弹出
    const timeMatch = findLastTimeWord(textBefore);
    if (timeMatch) {
      const { start, end } = timeMatch;
      // 时间词后必须是：空格、逗号、或直接是光标（不能已经跟了 #）
      const afterTime = textBefore.substring(end);
      // 已经跟了 #标签 → 不弹（让方式 A 处理）
      if (/^\s*#/.test(afterTime)) {
        setOpen(false);
        return;
      }
      // 时间词后面允许有少量空格，不超过 3 个字符
      if (afterTime.length <= 3 && !afterTime.includes("#")) {
        setQuery("");
        showAtPos(el, Math.min(end, pos));
        return;
      }
      if (pos === end && lastChar !== "#") {
        setQuery("");
        showAtPos(el, end);
        return;
      }
    }

    setOpen(false);
  }

  function showAtPos(el: HTMLTextAreaElement, charPos: number) {
    const { x, y, height } = getTextareaCoordForPos(el, charPos);
    const rect = el.getBoundingClientRect();
    setCoords({
      x: Math.min(x, rect.right - 210),
      y: y + height + 2,
    });
    setOpen(true);
  }

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.addEventListener("input", checkTrigger);
    return () => el.removeEventListener("input", checkTrigger);
  }, []); // eslint-disable-line

  // 选中标签
  const selectTag = useCallback(
    (tagName: string) => {
      const el = textareaRef.current;
      if (!el) return;

      const pos = el.selectionStart;
      const textBefore = el.value.substring(0, pos);
      const textAfter = el.value.substring(pos);

      let newValue: string;
      let newCursor: number;

      // 检查是否有 # 触发器
      const hashIdx = textBefore.lastIndexOf("#");
      if (hashIdx !== -1) {
        const after = textBefore.substring(hashIdx + 1);
        if (!after.includes(" ") && !after.includes("\n")) {
          // 方式 A：替换 # 开始的半截
          const before = el.value.substring(0, hashIdx);
          const replaced = before + `#${tagName} `;
          newCursor = replaced.length;
          let skip = textAfter.length;
          const sp = textAfter.indexOf(" "), nl = textAfter.indexOf("\n");
          if (sp !== -1) skip = sp;
          if (nl !== -1) skip = Math.min(skip, nl);
          newValue = replaced + textAfter.substring(skip);
        } else {
          // 方式 B：光标处插入
          newValue = textBefore + `#${tagName} ` + textAfter;
          newCursor = textBefore.length + tagName.length + 2;
        }
      } else {
        // 方式 B：光标处插入 #标签
        newValue = textBefore + `#${tagName} ` + textAfter;
        newCursor = textBefore.length + tagName.length + 2;
      }

      onInsert(newValue);
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
      <div className="px-3 py-1 text-[10px] text-[var(--text-muted)]">
        ↑↓选择 Enter确认 Esc关闭
      </div>
      {filtered.map((tag, idx) => (
        <button
          key={tag.id}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
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

// === 查找光标前最近的时间词 ===
function findLastTimeWord(text: string): { start: number; end: number } | null {
  // 使用 matchAll 替代 exec+g，避免 lastIndex 残留
  const regex = /(早上|上午|中午|下午|傍晚|晚上|凌晨|夜里|早晨)?\s*(\d{1,2})\s*[点:：]\s*(\d{0,2})\s*(?:分|半)?/g;
  const matches = [...text.matchAll(regex)];
  if (matches.length === 0) return null;
  // 取最后一个匹配
  const last = matches[matches.length - 1];
  const matchEnd = (last.index ?? 0) + last[0].length;
  // 时间词不能离光标太远（最多 5 个字符）
  if (text.length - matchEnd > 5) return null;
  return { start: last.index ?? 0, end: matchEnd };
}

// === 辅助：计算 textarea 中字符位置 ===
function getTextareaCoordForPos(
  el: HTMLTextAreaElement,
  pos: number
): { x: number; y: number; height: number } {
  const style = getComputedStyle(el);
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

  const before = el.value.substring(0, pos);
  const after = el.value.substring(pos) || ".";
  div.textContent = before;
  const mark = document.createElement("span");
  mark.textContent = after;
  div.appendChild(mark);
  document.body.appendChild(div);
  const markRect = mark.getBoundingClientRect();
  document.body.removeChild(div);

  const elRect = el.getBoundingClientRect();
  return {
    x: elRect.left + (markRect.left - elRect.left),
    y: elRect.top + (markRect.top - elRect.top) - el.scrollTop,
    height: markRect.height,
  };
}
