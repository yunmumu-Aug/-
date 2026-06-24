// ============================================
// 时光轴 — TypeScript 类型定义
// ============================================

// ----- 用户 -----
export interface Profile {
  id: string;
  display_name: string | null;
  created_at: string;
}

// ----- 标签 -----
export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  is_preset: boolean;
  created_at: string;
}

// ----- 日记 -----
export interface Diary {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  content: string; // 可能是密文（加密后）
  wake_time: string | null; // YYYY-MM-DDTHH:MM (datetime-local)
  sleep_time: string | null; // YYYY-MM-DDTHH:MM (datetime-local)
  created_at: string;
  updated_at: string;
  // 关联数据（前端组装）
  tags?: DiaryTagRelation[];
}

// ----- 日记-标签关联 -----
export interface DiaryTagRelation {
  id: string;
  diary_id: string;
  tag_id: string;
  time_label: string | null; // 解析出的时间 "11:00"
  position: number;
  tag?: Tag; // 前端组装
}

// ----- 标签解析结果（前端用） -----
export interface ParsedTag {
  tagName: string; // 标签名（不含#）
  timeStr: string | null; // 关联的时间
  position: number; // 在原文中的位置
}

// ----- 图表数据 -----
export interface TagStat {
  tagId: string;
  tagName: string;
  color: string;
  count: number;
  totalMinutes: number;
}

export interface DailyTagStat {
  date: string;
  tagName: string;
  count: number;
}

export interface SleepStat {
  date: string;
  wakeTime: string | null;
  sleepTime: string | null;
  durationHours: number | null;
}

export interface WeeklySleepStat {
  dayOfWeek: string; // 周一～周日
  date: string;
  durationHours: number | null;
  wakeTime: string | null;
  sleepTime: string | null;
}

// ----- 图表数据请求参数 -----
export type ChartRange = "today" | "week" | "month" | "year";

export interface ChartRequest {
  range: ChartRange;
  date?: string; // 参考日期，默认今天
}

// ----- 热力图数据 -----
export interface HeatmapDay {
  date: string;
  count: number; // 标签数 / 活动丰富度
  hasDiary: boolean;
}

// ----- 总结卡片数据 -----
export interface SummaryCard {
  totalDiaries: number;
  totalTags: number;
  topTag: { name: string; count: number } | null;
  avgSleepHours: number | null;
  earliestWake: string | null;
  latestWake: string | null;
  longestStreak: number; // 最长连续记录天数
}

// ----- API 响应 -----
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ----- 日记表单 -----
export interface DiaryFormData {
  date: string;
  content: string;
  wakeTime: string;
  sleepTime: string;
}
