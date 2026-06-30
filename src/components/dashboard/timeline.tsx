"use client";

import { useRouter } from "next/navigation";
import { useTagFilter } from "@/hooks/use-tag-filter";
import type { Diary } from "@/types";

/**
 * 首页时间轴组件
 *
 * 展示最近日记的时间轴卡片列表。
 * 左侧：彩色圆点 + 连接线
 * 右侧：日期 + 内容预览 + 标签
 */

interface TimelineItemProps {
  diary: Diary;
  isLast: boolean;
  delay: number;
}

function TimelineItem({ diary, isLast, delay }: TimelineItemProps) {
  const router = useRouter();
  const { setSelectedTag } = useTagFilter();

  const contentPreview = diary.content
    ? diary.content.slice(0, 120)
    : "";

  const weekDay = new Date(diary.date).toLocaleDateString("zh-CN", { weekday: "short" });
  const dateLabel = diary.date.slice(5); // MM-DD

  return (
    <div
      className="flex items-stretch gap-3 animate-[tl-in_0.3s_ease-out_both] cursor-pointer group"
      style={{ animationDelay: `${delay * 60}ms` }}
      onClick={() => router.push("/write")}
    >
      {/* 左侧：圆点 + 连接线 */}
      <div className="flex flex-col items-center shrink-0 pt-1" style={{ width: 24 }}>
        <div className="w-3 h-3 rounded-full border-2 border-blue-400 dark:border-blue-500 bg-surface dark:bg-slate-800 shrink-0 z-10 group-hover:border-blue-500 transition-colors" />
        {!isLast && (
          <div className="w-0.5 flex-1 mt-1 rounded-full bg-gray-200 dark:bg-slate-700" />
        )}
      </div>

      {/* 右侧：卡片 */}
      <div className="flex-1 mb-4 min-w-0">
        <div
          className="bg-surface dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/50 p-4 shadow-sm
            group-hover:shadow-md group-hover:-translate-y-0.5 transition-all duration-200"
        >
          {/* 日期行 */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-700/50 px-2 py-0.5 rounded-md">
              {dateLabel} {weekDay}
            </span>
            {diary.wake_time && (
              <span className="text-[10px] text-gray-400 dark:text-slate-500">
                ⏰ {diary.wake_time.split("T")[1]?.slice(0, 5)}
              </span>
            )}
            {diary.sleep_time && (
              <span className="text-[10px] text-gray-400 dark:text-slate-500">
                🌙 {diary.sleep_time.split("T")[1]?.slice(0, 5)}
              </span>
            )}
          </div>

          {/* 内容预览 */}
          {contentPreview && (
            <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed line-clamp-2 mb-2">
              {contentPreview}{diary.content.length > 120 ? "…" : ""}
            </p>
          )}

          {/* 标签 */}
          {diary.tags && diary.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {diary.tags.slice(0, 6).map((t) => (
                <span
                  key={t.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTag(t.tag?.name || null);
                    router.push("/write");
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium cursor-pointer hover:opacity-80"
                  style={{
                    backgroundColor: (t.tag?.color || "#3B82F6") + "18",
                    color: t.tag?.color || "#3B82F6",
                  }}
                >
                  #{t.tag?.name || "?"}
                  {t.time_label && <span className="opacity-50">{t.time_label}</span>}
                </span>
              ))}
              {diary.tags.length > 6 && (
                <span className="text-[10px] text-gray-400 dark:text-slate-500 self-center">
                  +{diary.tags.length - 6}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface TimelineProps {
  diaries: Diary[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

export default function Timeline({ diaries, loading, hasMore, onLoadMore }: TimelineProps) {
  if (!loading && diaries.length === 0) return null;

  return (
    <div className="bg-surface dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/50 p-4">
      <h3 className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
        <span>🕐 时间轴</span>
        {loading && (
          <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        )}
      </h3>

      {diaries.length === 0 && loading && (
        <div className="py-8 text-center">
          <p className="text-xs text-gray-400 dark:text-slate-500">加载中...</p>
        </div>
      )}

      {diaries.length > 0 && (
        <>
          {diaries.map((diary, i) => (
            <TimelineItem
              key={diary.id}
              diary={diary}
              isLast={i === diaries.length - 1 && !hasMore}
              delay={i}
            />
          ))}

          {/* 加载更多 */}
          {hasMore && (
            <div className="text-center pt-2">
              <button
                onClick={onLoadMore}
                disabled={loading}
                className="px-4 py-1.5 text-xs text-gray-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors disabled:opacity-50"
              >
                {loading ? "加载中..." : "加载更多 ↑"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
