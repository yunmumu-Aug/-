// ============================================
// 时间解析器 — chrono-node 封装（备用，主力用 tag-parser）
// ============================================

/**
 * 使用 chrono-node 解析文本中的时间表达
 * 作为 tag-parser 的补充，处理更复杂的时间格式
 *
 * chrono-node 支持的格式示例：
 * - "明天下午3点"
 * - "下周三"
 * - "2024年6月24日"
 * - "晚上8点"
 * - "上周五"
 */

export interface ChronoTimeResult {
  text: string;
  date: Date;
  formattedTime: string; // HH:MM
}

/**
 * 解析文本中的时间表达
 * 注意：需要 chrono-node 已安装
 */
export async function parseTimeExpressions(
  text: string
): Promise<ChronoTimeResult[]> {
  try {
    const chrono = await import("chrono-node");

    // chrono-node v2 使用 en 和 ja 解析器
    // 中文兼容的解析
    const results = chrono.parse(text, new Date(), {
      forwardDate: false,
    });

    return results.map((r: any) => {
      const date = r.start.date();
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const formattedTime = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;

      return {
        text: r.text,
        date,
        formattedTime,
      };
    });
  } catch {
    // chrono-node 不可用时返回空数组
    return [];
  }
}

/**
 * 从文本中提取日期引用
 */
export async function parseDateReferences(text: string): Promise<Date[]> {
  try {
    const chrono = await import("chrono-node");
    const results = chrono.parse(text, new Date(), {
      forwardDate: false,
    });
    return results.map((r: any) => r.start.date());
  } catch {
    return [];
  }
}
