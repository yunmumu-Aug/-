"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useDiary, useTags } from "@/hooks/use-diary";
import { parseDiaryTags } from "@/lib/tag-parser";
import TagPicker from "@/components/diary/tag-picker";
import type { Tag } from "@/types";

function getTodayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function getDefaultWake(): string {
  return `${getTodayStr()}T07:00`;
}

function getDefaultSleep(): string {
  return `${getTodayStr()}T23:00`;
}

function formatDisplayDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { saveDiary, getDiary, saving } = useDiary();
  const { getTags, createTag } = useTags();
  const router = useRouter();

  const [diaryDate, setDiaryDate] = useState(getTodayStr());
  const [wakeDatetime, setWakeDatetime] = useState(getDefaultWake());
  const [sleepDatetime, setSleepDatetime] = useState(getDefaultSleep());
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<Tag[]>([]);
  const [loadedDate, setLoadedDate] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 未登录 → 跳转登录页
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth");
    }
  }, [user, authLoading, router]);

  // 加载标签列表
  useEffect(() => {
    if (user) {
      getTags().then(setTags).catch(console.error);
    }
  }, [user, getTags]);

  // 日期变化时加载日记
  useEffect(() => {
    if (!user || diaryDate === loadedDate) return;

    let cancelled = false;
    getDiary(diaryDate).then((diary) => {
      if (cancelled) return;
      if (diary) {
        setContent(diary.content || "");
        setWakeDatetime(
          diary.wake_time || `${diaryDate}T07:00`
        );
        setSleepDatetime(
          diary.sleep_time || `${diaryDate}T23:00`
        );
      } else {
        setContent("");
        setWakeDatetime(`${diaryDate}T07:00`);
        setSleepDatetime(`${diaryDate}T23:00`);
      }
      setLoadedDate(diaryDate);
      setSaveMessage(null);
    });

    return () => { cancelled = true; };
  }, [diaryDate, user, getDiary, loadedDate]);

  // 解析日记中的标签
  const parsedTags = useMemo(() => {
    return parseDiaryTags(content);
  }, [content]);

  // 保存日记
  async function handleSave() {
    if (!user) return;
    setSaveMessage(null);

    try {
      // 确保所有 #标签 在 tags 表中存在
      const tagNameSet = new Set(parsedTags.map((p) => p.tagName));
      const existingTagMap = new Map(tags.map((t) => [t.name, t]));
      const tagIdMap = new Map(tags.map((t) => [t.name, t.id]));

      // 创建不存在的标签
      for (const tagName of tagNameSet) {
        if (!existingTagMap.has(tagName)) {
          try {
            const newTag = await createTag(tagName);
            if (newTag) {
              tagIdMap.set(tagName, newTag.id);
            }
          } catch {
            // 标签可能已存在，重新获取
          }
        }
      }

      // 重新获取标签列表以拿到最新 ID
      const updatedTags = await getTags();
      const finalIdMap = new Map(updatedTags.map((t) => [t.name, t.id]));

      // 构建标签关联数据
      const diaryTags = parsedTags
        .filter((p) => finalIdMap.has(p.tagName))
        .map((p) => ({
          tagId: finalIdMap.get(p.tagName)!,
          timeLabel: p.timeStr,
        }));

      await saveDiary({
        date: diaryDate,
        content,
        wakeTime: wakeDatetime,
        sleepTime: sleepDatetime,
        tags: diaryTags,
      });

      setTags(updatedTags);
      setSaveMessage("✅ 保存成功");
      setTimeout(() => setSaveMessage(null), 2000);
    } catch (e: any) {
      setSaveMessage(`❌ ${e.message || "保存失败"}`);
    }
  }

  // 草稿自动保存（localStorage）
  useEffect(() => {
    const key = `draft-${diaryDate}`;
    if (content) {
      localStorage.setItem(key, content);
    }
    return () => {
      // 不自动清理
    };
  }, [content, diaryDate]);

  // 加载草稿
  useEffect(() => {
    const key = `draft-${diaryDate}`;
    const draft = localStorage.getItem(key);
    if (draft && !content) {
      setContent(draft);
    }
  }, [diaryDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayDate = useMemo(() => formatDisplayDate(diaryDate), [diaryDate]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-[var(--text-secondary)]">加载中...</p>
      </div>
    );
  }

  if (!user) return null; // 即将跳转

  return (
    <div className="w-full max-w-full md:max-w-3xl mx-auto px-4 py-6 md:py-8 overflow-x-hidden">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">
          ✍️ 写日记
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {displayDate}
        </p>
      </div>

      {/* Date picker */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
          📅 日记日期
        </label>
        <div className="relative w-full md:w-60">
          <input
            type="date"
            value={diaryDate}
            onChange={(e) => setDiaryDate(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)]
              focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
          />
        </div>
      </div>

      {/* Wake / Sleep time */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 min-w-0 p-3 md:p-4 bg-[var(--muted)] rounded-xl border border-[var(--border)]">
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            ⏰ 起床时间
          </label>
          <input
            type="datetime-local"
            value={wakeDatetime}
            onChange={(e) => setWakeDatetime(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-[var(--border)] rounded-lg text-sm
              focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
          />
        </div>
        <div className="flex-1 min-w-0 p-3 md:p-4 bg-[var(--muted)] rounded-xl border border-[var(--border)]">
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
            🌙 入睡时间
          </label>
          <input
            type="datetime-local"
            value={sleepDatetime}
            onChange={(e) => setSleepDatetime(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-[var(--border)] rounded-lg text-sm
              focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
          />
        </div>
      </div>

      {/* Diary content */}
      <div className="mb-4 relative">
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
          📝 日记内容
        </label>
        <textarea
          ref={textareaRef}
          rows={14}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="在这里写日记...&#10;&#10;用 #标签 标记活动，如：&#10;上午9点 #起床，然后 #刷牙，吃了 #早饭，开始 #工作"
          className="w-full px-4 py-3 border border-[var(--border)] rounded-lg text-sm leading-relaxed resize-y
            focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
        />
        <TagPicker
          tags={tags}
          textareaRef={textareaRef}
          onInsert={(newText) => {
            setContent(newText);
          }}
        />
        <p className="text-xs text-[var(--text-muted)] mt-1.5">
          💡 输入 # 号自动弹出标签选择框，支持键盘 ↑↓ 选择，Enter 确认
        </p>
      </div>

      {/* Tag preview */}
      <div className="p-4 bg-[var(--muted)] rounded-xl border border-[var(--border)] mb-6">
        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-2">
          🏷️ 识别的标签
        </h3>
        <div className="flex flex-wrap gap-2 min-h-[32px] items-center">
          {parsedTags.length > 0 ? (
            parsedTags.map((pt, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700"
              >
                #{pt.tagName}
                {pt.timeStr && (
                  <span className="opacity-60 text-[10px]">{pt.timeStr}</span>
                )}
              </span>
            ))
          ) : (
            <span className="text-xs text-[var(--text-muted)]">
              写日记后这里会自动显示识别到的标签...
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3">
        <div>
          {saveMessage && (
            <span
              className={`text-sm ${
                saveMessage.startsWith("✅")
                  ? "text-green-600"
                  : "text-red-500"
              }`}
            >
              {saveMessage}
            </span>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              const key = `draft-${diaryDate}`;
              localStorage.setItem(key, content);
              setSaveMessage("✅ 草稿已暂存");
              setTimeout(() => setSaveMessage(null), 1500);
            }}
            className="px-4 py-2.5 border border-[var(--border)] text-sm font-medium rounded-lg hover:bg-[var(--muted)] transition-colors"
          >
            暂存草稿
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-[var(--accent)] text-white text-sm font-medium rounded-lg
              hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存日记"}
          </button>
        </div>
      </div>
    </div>
  );
}
