// ============================================
// #标签 解析器 — 从日记文本中提取标签和时间关联
// ============================================

import type { ParsedTag } from "@/types";

/**
 * 正则匹配所有 #标签名
 * 支持中文、英文、数字、下划线
 */
const TAG_REGEX = /#([一-龥\w가-힯぀-ヿ]+)/g;

/**
 * 中日韩文本中常见的时间表达
 * 支持格式：9点、9:00、9：00、上午9点、下午3点、3点半、9:30、晚上8点
 */
const TIME_PATTERNS = [
  /(?:早上|上午|中午|下午|傍晚|晚上|凌晨|夜里)?\s*(\d{1,2})\s*[点:：时]\s*(\d{0,2})\s*(?:分|半)?/g,
  /(\d{1,2})\s*[:：]\s*(\d{2})/g,
];

/** 时间范围匹配：13点-14点、13:00-14:00、13点～14点、13点到14点、10点半到11点 */
// 每次使用新建，避免 g 标志状态问题
function parseTimeRange(text: string, tagPos: number): string | null {
  const searchStart = Math.max(0, tagPos - 30);
  const searchText = text.substring(searchStart, tagPos);
  const re = /(\d{1,2})\s*[点:：时]\s*(\d{0,2})(半)?\s*(?:分)?\s*[-–—～~到至]\s*(\d{1,2})\s*[点:：时]\s*(\d{0,2})(半)?/g;
  let best: { h1: number; m1: number; h2: number; m2: number; dist: number } | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(searchText)) !== null) {
    const matchEnd = searchStart + m.index + m[0].length;
    const dist = tagPos - matchEnd;
    if (dist > 8) continue;
    const h1 = parseInt(m[1], 10);
    let m1 = parseInt(m[2] || "0", 10);
    if (isNaN(m1)) m1 = 0;
    if (m[3]) m1 = 30;
    const h2 = parseInt(m[4], 10);
    let m2 = parseInt(m[5] || "0", 10);
    if (isNaN(m2)) m2 = 0;
    if (m[6]) m2 = 30;
    if (!best || dist < best.dist) best = { h1, m1, h2, m2, dist };
  }
  if (!best) return null;
  return `${String(best.h1).padStart(2, "0")}:${String(best.m1).padStart(2, "0")}-${String(best.h2).padStart(2, "0")}:${String(best.m2).padStart(2, "0")}`;
}

interface TagMatch {
  tag: string;
  index: number;
}

/**
 * 从日记文本中提取所有标签及其位置
 */
export function extractTags(text: string): TagMatch[] {
  const matches: TagMatch[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  TAG_REGEX.lastIndex = 0;

  while ((match = TAG_REGEX.exec(text)) !== null) {
    matches.push({
      tag: match[1],
      index: match.index,
    });
  }

  return matches;
}

/**
 * 在给定位置之前查找最近的时间表达
 * 返回格式化的时间字符串或 null
 */
export function findNearestTime(
  text: string,
  position: number
): string | null {
  // 取标签之前最多 30 个字符的文本
  const searchStart = Math.max(0, position - 30);
  const searchText = text.substring(searchStart, position);

  // 先检查时间范围：13点-14点、13:00-14:00
  const rangeResult = parseTimeRange(text, position);
  if (rangeResult) return rangeResult;

  let bestMatch: string | null = null;
  let bestDistance = Infinity;

  // 搜索所有时间模式
  for (const pattern of TIME_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(searchText)) !== null) {
      const distance = position - (searchStart + match.index);
      // 取最近的（距离最小的）
      if (distance < bestDistance) {
        bestDistance = distance;
        // 规范化时间表达
        bestMatch = normalizeTime(match[0]);
      }
    }
  }

  // 如果标签前面有一个明显的时间词的间隔阈值（最多20个字符）
  if (bestDistance > 20) {
    return null;
  }

  return bestMatch;
}

/**
 * 规范化时间表达为 HH:MM 格式
 */
function normalizeTime(timeStr: string): string {
  let hours = 0;
  let minutes = 0;

  // 去除前后空格
  timeStr = timeStr.trim();

  // 处理时段前缀
  if (/早上|凌晨/.test(timeStr)) {
    // 默认不调整
  } else if (/上午/.test(timeStr)) {
    // 上午不调整
  } else if (/中午/.test(timeStr)) {
    // 中午 12 点
  } else if (/下午|傍晚/.test(timeStr)) {
    // 下午 +12（如"下午3点" = 15:00）
  } else if (/晚上|夜里/.test(timeStr)) {
    // 晚上 +12（如"晚上8点" = 20:00）
  }

  // 提取数字
  const numbers = timeStr.match(/\d+/g);
  if (!numbers || numbers.length === 0) return timeStr;

  hours = parseInt(numbers[0], 10);
  if (numbers.length > 1) {
    minutes = parseInt(numbers[1], 10);
  }

  // 处理"X点半"
  if (/半/.test(timeStr)) {
    minutes = 30;
  }

  // 应用时段偏移
  if (/下午|傍晚|晚上|夜里/.test(timeStr) && hours < 12) {
    hours += 12;
  }
  if (/中午/.test(timeStr) && hours < 12) {
    hours += 12;
  }

  // 边界处理
  hours = Math.min(23, Math.max(0, hours));
  minutes = Math.min(59, Math.max(0, minutes));

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

/**
 * 完整解析日记文本：返回标签及其关联的时间
 */
export function parseDiaryTags(text: string): ParsedTag[] {
  if (!text.trim()) return [];

  const tagMatches = extractTags(text);
  if (tagMatches.length === 0) return [];

  return tagMatches.map((tm, i) => ({
    tagName: tm.tag,
    timeStr: findNearestTime(text, tm.index),
    position: i,
  }));
}

/**
 * 高亮日记中的 #标签（用于渲染预览）
 */
export function highlightTags(text: string): Array<{
  type: "text" | "tag";
  content: string;
}> {
  const segments: Array<{ type: "text" | "tag"; content: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  TAG_REGEX.lastIndex = 0;

  while ((match = TAG_REGEX.exec(text)) !== null) {
    // 标签前的普通文本
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        content: text.substring(lastIndex, match.index),
      });
    }
    // 标签
    segments.push({
      type: "tag",
      content: match[1],
    });
    lastIndex = TAG_REGEX.lastIndex;
  }

  // 剩余文本
  if (lastIndex < text.length) {
    segments.push({
      type: "text",
      content: text.substring(lastIndex),
    });
  }

  return segments;
}
