// ============================================
// 日记数据处理工具
// ============================================

import type { Diary, SleepStat } from "@/types";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, eachDayOfInterval, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";

/**
 * 格式化日期为 YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * 格式化日期为用户友好的显示
 */
export function formatDateDisplay(dateStr: string): string {
  const date = parseISO(dateStr);
  return format(date, "yyyy年M月d日 EEEE", { locale: zhCN });
}

/**
 * 计算睡眠时长（小时）
 * wakeTime 和 sleepTime 格式：YYYY-MM-DDTHH:MM
 */
export function calcSleepDuration(
  wakeTime: string | null,
  sleepTime: string | null
): number | null {
  if (!wakeTime || !sleepTime) return null;

  const wakeDate = new Date(wakeTime);
  const sleepDate = new Date(sleepTime);

  if (isNaN(wakeDate.getTime()) || isNaN(sleepDate.getTime())) return null;

  let diffMs = wakeDate.getTime() - sleepDate.getTime();

  // 如果入睡时间在起床时间之后（即入睡在当天晚上，起床在当天早上），
  // 说明计算方向有问题，需要调整
  if (diffMs <= 0) {
    diffMs += 24 * 60 * 60 * 1000; // 加一天
  }

  return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
}

/**
 * 获取本周日期范围
 */
export function getWeekRange(refDate: Date = new Date()): {
  start: Date;
  end: Date;
  days: Date[];
} {
  const start = startOfWeek(refDate, { weekStartsOn: 1 }); // 周一
  const end = endOfWeek(refDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });
  return { start, end, days };
}

/**
 * 获取本月日期范围
 */
export function getMonthRange(refDate: Date = new Date()): {
  start: Date;
  end: Date;
  weeks: Date[][];
} {
  const start = startOfMonth(refDate);
  const end = endOfMonth(refDate);
  const days = eachDayOfInterval({ start, end });

  // 按周分组
  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];

  for (const day of days) {
    if (currentWeek.length === 0 && day.getDay() !== 1) {
      // 填充月初空白
    }
    currentWeek.push(day);
    if (day.getDay() === 0 || days.indexOf(day) === days.length - 1) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  return { start, end, weeks };
}

/**
 * 组装日记对象的睡眠统计数据
 */
export function diariesToSleepStats(diaries: Diary[]): SleepStat[] {
  return diaries.map((d) => ({
    date: d.date,
    wakeTime: d.wake_time,
    sleepTime: d.sleep_time,
    durationHours: calcSleepDuration(d.wake_time, d.sleep_time),
  }));
}

/**
 * 计算连续记录天数（最长连续）
 */
export function calcLongestStreak(dates: string[]): number {
  if (dates.length === 0) return 0;

  const sorted = [...dates].sort();
  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diffDays =
      (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays === 1) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  return maxStreak;
}
