import { NextRequest, NextResponse } from "next/server";
import { createServerClient, getUserIdFromToken } from "@/lib/supabase-server";

// GET /api/diaries?date=YYYY-MM-DD — 获取某天日记
// GET /api/diaries?start=YYYY-MM-DD&end=YYYY-MM-DD — 获取日期范围日记
export async function GET(request: NextRequest) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const userId = getUserIdFromToken(token);
  if (!userId) return NextResponse.json({ error: "无效 token" }, { status: 401 });

  const supabase = createServerClient(token);
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  const baseQuery = supabase.from("diaries").select(
    `*, tags:diary_tags(id, tag_id, time_label, position, tag:tags(id, name, color))`
  ).eq("user_id", userId) as any;

  try {
    if (date) {
      const { data, error, status } = await baseQuery.eq("date", date).maybeSingle();
      if (error && status !== 406) throw error;
      return NextResponse.json({ data: data || null });
    }

    let query = baseQuery;
    if (start && end) {
      query = query.gte("date", start).lte("date", end).order("date", { ascending: true });
    } else {
      query = query.order("date", { ascending: false }).limit(30);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    console.error("GET /api/diaries error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/diaries — 创建或更新日记
export async function POST(request: NextRequest) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const userId = getUserIdFromToken(token);
  if (!userId) return NextResponse.json({ error: "无效 token" }, { status: 401 });

  const supabase = createServerClient(token);
  const body = await request.json();
  const { date, content, wakeTime, sleepTime, tags } = body;

  if (!date) {
    return NextResponse.json({ error: "日期不能为空" }, { status: 400 });
  }

  try {
    // Upsert 日记
    const { data: diary, error: diaryError } = await supabase
      .from("diaries")
      .upsert({
        user_id: userId,
        date,
        content: content || "",
        wake_time: wakeTime || null,
        sleep_time: sleepTime || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,date" })
      .select()
      .single();

    if (diaryError) throw diaryError;

    // 如果有标签，先删除旧的再插入新的
    if (tags && Array.isArray(tags)) {
      await supabase.from("diary_tags").delete().eq("diary_id", diary.id);

      if (tags.length > 0) {
        const tagRows = tags.map((t: any, idx: number) => ({
          diary_id: diary.id,
          tag_id: t.tagId,
          time_label: t.timeLabel || null,
          position: idx,
        }));

        const { error: tagError } = await supabase.from("diary_tags").insert(tagRows);
        if (tagError) throw tagError;
      }
    }

    // 返回完整日记
    const { data: fullDiary } = await supabase
      .from("diaries")
      .select(`*, tags:diary_tags(id, tag_id, time_label, position, tag:tags(id, name, color))`)
      .eq("id", diary.id)
      .single() as any;

    return NextResponse.json({ data: fullDiary });
  } catch (error: any) {
    console.error("POST /api/diaries error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
