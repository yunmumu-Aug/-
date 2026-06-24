// ============================================
// 图表数据处理工具
// ============================================

import type { Diary, Tag, DiaryTagRelation, TagStat, SummaryCard } from "@/types";
import { calcSleepDuration, calcLongestStreak } from "./diary-utils";

/**
 * 汇总标签统计数据
 * 当 allTags 为空时，也从 diary 的 tags 关系中自动收集
 */
export function aggregateTagStats(
  diaries: Diary[],
  allTags: Tag[]
): TagStat[] {
  const tagMap = new Map<string, TagStat>();

  // 初始化已有标签
  for (const tag of allTags) {
    tagMap.set(tag.id, {
      tagId: tag.id,
      tagName: tag.name,
      color: tag.color,
      count: 0,
      totalMinutes: 0,
    });
  }

  // 统计
  for (const diary of diaries) {
    if (!diary.tags) continue;
    for (const relation of diary.tags) {
      const tid = relation.tag_id;
      if (!tagMap.has(tid) && relation.tag) {
        // 自动从关系数据中收集标签
        tagMap.set(tid, {
          tagId: tid,
          tagName: relation.tag.name,
          color: relation.tag.color,
          count: 0,
          totalMinutes: 0,
        });
      }
      const stat = tagMap.get(tid);
      if (stat) {
        stat.count++;
        if (relation.time_label) {
          const [h, m] = relation.time_label.split(":").map(Number);
          stat.totalMinutes += h * 60 + m;
        }
      }
    }
  }

  return Array.from(tagMap.values())
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);
}

/**
 * 按天聚合标签统计（用于柱状图/趋势图）
 */
export function aggregateTagsByDay(
  diaries: Diary[]
): Array<{ date: string; stats: TagStat[] }> {
  return diaries.map((diary) => ({
    date: diary.date,
    stats: diary.tags
      ? diary.tags.map((rel) => ({
          tagId: rel.tag_id,
          tagName: rel.tag?.name || "未知",
          color: rel.tag?.color || "#3B82F6",
          count: 1,
          totalMinutes: 0,
        }))
      : [],
  }));
}

/**
 * 按周聚合标签统计（本月用）
 */
export function aggregateTagsByWeek(
  diaries: Diary[],
  weeks: Date[][]
): Array<{ weekLabel: string; stats: TagStat[] }> {
  return weeks.map((weekDays, idx) => {
    const weekDates = weekDays.map((d) =>
      d.toISOString().split("T")[0]
    );
    const weekDiaries = diaries.filter((d) => weekDates.includes(d.date));

    const tagMap = new Map<string, TagStat>();
    for (const diary of weekDiaries) {
      if (!diary.tags) continue;
      for (const rel of diary.tags) {
        const key = rel.tag_id;
        if (!tagMap.has(key)) {
          tagMap.set(key, {
            tagId: rel.tag_id,
            tagName: rel.tag?.name || "未知",
            color: rel.tag?.color || "#3B82F6",
            count: 0,
            totalMinutes: 0,
          });
        }
        tagMap.get(key)!.count++;
      }
    }

    return {
      weekLabel: `第${idx + 1}周`,
      stats: Array.from(tagMap.values()).sort((a, b) => b.count - a.count),
    };
  });
}

/**
 * 生成总结卡片数据
 */
export function generateSummary(
  diaries: Diary[],
  tagStats: TagStat[]
): SummaryCard {
  const diariesWithContent = diaries.filter(
    (d) => d.content.trim().length > 0
  );
  const dates = diariesWithContent.map((d) => d.date);

  // 平均睡眠
  let totalSleep = 0;
  let sleepCount = 0;
  let earliestWake: string | null = null;
  let latestWake: string | null = null;

  for (const diary of diaries) {
    if (diary.wake_time) {
      if (!earliestWake || diary.wake_time < earliestWake) {
        earliestWake = diary.wake_time;
      }
      if (!latestWake || diary.wake_time > latestWake) {
        latestWake = diary.wake_time;
      }
    }

    const duration = calcSleepDuration(diary.wake_time, diary.sleep_time);
    if (duration !== null) {
      totalSleep += duration;
      sleepCount++;
    }
  }

  return {
    totalDiaries: diariesWithContent.length,
    totalTags: new Set(diaries.flatMap((d) => d.tags?.map((t) => t.tag_id) || [])).size,
    topTag:
      tagStats.length > 0
        ? { name: tagStats[0].tagName, count: tagStats[0].count }
        : null,
    avgSleepHours:
      sleepCount > 0
        ? Math.round((totalSleep / sleepCount) * 100) / 100
        : null,
    earliestWake,
    latestWake,
    longestStreak: calcLongestStreak(dates),
  };
}

/**
 * 生成热力图数据
 */
export function generateHeatmapData(
  diaries: Diary[],
  year: number
): Array<{ date: string; count: number; hasDiary: boolean }> {
  const diaryMap = new Map<string, Diary>();
  for (const d of diaries) {
    diaryMap.set(d.date, d);
  }

  const result: Array<{ date: string; count: number; hasDiary: boolean }> = [];

  // 生成全年日期
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];
    const diary = diaryMap.get(dateStr);

    result.push({
      date: dateStr,
      count: diary?.tags?.length || 0,
      hasDiary: !!diary && diary.content.trim().length > 0,
    });
  }

  return result;
}
