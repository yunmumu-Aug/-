import { NextRequest, NextResponse } from "next/server";
import { createServerClient, getUserIdFromToken } from "@/lib/supabase-server";

// GET /api/tags — 获取用户所有标签
export async function GET(request: NextRequest) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const userId = getUserIdFromToken(token);
  if (!userId) return NextResponse.json({ error: "无效 token" }, { status: 401 });

  // 处理删除请求：GET /api/tags?id=xxx 改为 DELETE
  if (request.method === "DELETE" || request.nextUrl.searchParams.has("id")) {
    return handleDelete(request, userId);
  }

  const supabase = createServerClient(token);

  try {
    const { data, error } = await supabase
      .from("tags")
      .select("*")
      .eq("user_id", userId)
      .order("name");

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: any) {
    console.error("GET /api/tags error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

const TAG_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#6366F1", "#06B6D4",
  "#84CC16", "#F97316", "#14B8A6", "#6B7280",
];

function randomColor(): string {
  return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
}

// POST /api/tags — 创建标签
export async function POST(request: NextRequest) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const userId = getUserIdFromToken(token);
  if (!userId) return NextResponse.json({ error: "无效 token" }, { status: 401 });

  const supabase = createServerClient(token);
  const body = await request.json();
  const { name, color } = body;

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "标签名不能为空" }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from("tags")
      .insert({
        user_id: userId,
        name: name.trim(),
        color: color || randomColor(),
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "标签已存在" }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/tags error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/tags — 更新标签（颜色等）
export async function PATCH(request: NextRequest) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const userId = getUserIdFromToken(token);
  if (!userId) return NextResponse.json({ error: "无效 token" }, { status: 401 });

  const supabase = createServerClient(token);
  const body = await request.json();
  const { id, name, color } = body;

  if (!id) return NextResponse.json({ error: "缺少标签 ID" }, { status: 400 });

  try {
    const updates: Record<string, any> = {};
    if (color) updates.color = color;
    if (name && name.trim()) updates.name = name.trim();

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "无更新内容" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("tags")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: any) {
    console.error("PATCH /api/tags error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/tags?id=xxx — 删除标签
export async function DELETE(request: NextRequest) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const userId = getUserIdFromToken(token);
  if (!userId) return NextResponse.json({ error: "无效 token" }, { status: 401 });

  return handleDelete(request, userId);
}

async function handleDelete(request: NextRequest, userId: string) {
  const supabase = createServerClient(
    request.headers.get("Authorization")?.replace("Bearer ", "")
  );
  const id = request.nextUrl.searchParams.get("id");

  if (!id) return NextResponse.json({ error: "缺少标签 ID" }, { status: 400 });

  try {
    // 先删关联
    await supabase.from("diary_tags").delete().eq("tag_id", id);
    // 再删标签
    const { error } = await supabase
      .from("tags")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
    return NextResponse.json({ data: { id } });
  } catch (error: any) {
    console.error("DELETE /api/tags error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
