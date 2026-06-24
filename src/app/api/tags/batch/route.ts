import { NextRequest, NextResponse } from "next/server";
import { createServerClient, getUserIdFromToken } from "@/lib/supabase-server";

// POST /api/tags/batch — 批量导入标签
export async function POST(request: NextRequest) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const userId = getUserIdFromToken(token);
  if (!userId) return NextResponse.json({ error: "无效 token" }, { status: 401 });

  const supabase = createServerClient(token);
  const body = await request.json();
  const { names } = body;

  if (!names || !Array.isArray(names) || names.length === 0) {
    return NextResponse.json({ error: "请提供标签名列表" }, { status: 400 });
  }

  try {
    const uniqueNames = [...new Set(
      names.map((n: string) => n.trim()).filter(Boolean)
    )];

    const rows = uniqueNames.map((name) => ({
      user_id: userId,
      name,
      color: "#3B82F6",
    }));

    const { error } = await supabase
      .from("tags")
      .upsert(rows, {
        onConflict: "user_id,name",
        ignoreDuplicates: true,
      });

    if (error) throw error;

    const { data: allTags } = await supabase
      .from("tags")
      .select("*")
      .eq("user_id", userId)
      .order("name");

    return NextResponse.json({ data: allTags }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/tags/batch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
