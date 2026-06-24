import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * 从 JWT token 中解码 user_id (sub)
 * 不依赖 Supabase Auth API，纯本地解码
 */
export function getUserIdFromToken(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    );
    return payload.sub || null;
  } catch {
    return null;
  }
}

/**
 * 创建服务端 Supabase 客户端（用于 API 路由）
 * 使用用户的 JWT token 传递身份，RLS 自动过滤
 */
export function createServerClient(accessToken?: string) {
  const options: Record<string, any> = {};
  if (accessToken) {
    options.global = {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    };
  }
  return createClient(supabaseUrl, supabaseAnonKey, options);
}
