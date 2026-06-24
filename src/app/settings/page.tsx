"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

export default function SettingsPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/auth");
  }, [user, loading, router]);

  if (loading) return null;
  if (!user) return null;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 md:py-8">
      <h1 className="text-2xl font-semibold mb-6">⚙️ 设置</h1>

      <div className="space-y-4">
        {/* Account info */}
        <div className="p-4 bg-[var(--muted)] rounded-xl border border-[var(--border)]">
          <h3 className="text-sm font-medium mb-2">📧 账号信息</h3>
          <p className="text-sm text-[var(--text-secondary)]">{user.email}</p>
        </div>

        {/* Encryption info */}
        <div className="p-4 bg-[var(--muted)] rounded-xl border border-[var(--border)]">
          <h3 className="text-sm font-medium mb-2">🔐 数据加密</h3>
          <p className="text-sm text-[var(--text-secondary)]">
            日记内容使用 AES-256-GCM 加密存储，只有你的密码能解密。
          </p>
        </div>

        {/* Sign out */}
        <button
          onClick={signOut}
          className="w-full py-3 text-sm font-medium text-red-500 bg-red-50 rounded-xl
            hover:bg-red-100 transition-colors"
        >
          🚪 退出登录
        </button>
      </div>
    </div>
  );
}
