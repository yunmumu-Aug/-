"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import InstallPrompt from "@/components/install-prompt";

function getInitials(email: string): string {
  return email.charAt(0).toUpperCase();
}

export default function SettingsPage() {
  const { user, profile, loading, signOut, updateProfile } = useAuth();
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(profile?.display_name || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/auth");
  }, [user, loading, router]);

  useEffect(() => {
    setNickname(profile?.display_name || "");
  }, [profile?.display_name]);

  if (loading || !user) return null;

  const displayName = profile?.display_name || user.email?.split("@")[0] || "用户";
  const initials = getInitials(displayName);
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("zh-CN", { year: "numeric", month: "long" })
    : "";

  async function handleSaveNickname() {
    setSaving(true);
    setMessage("");
    try {
      await updateProfile({ display_name: nickname.trim() || undefined });
      setEditing(false);
      setMessage("保存成功");
    } catch {
      setMessage("保存失败");
    }
    setSaving(false);
    setTimeout(() => setMessage(""), 2000);
  }

  async function handleSignOut() {
    setSigningOut(true);
    try { await signOut(); } catch { setSigningOut(false); }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 md:py-8">
      <h1 className="hidden lg:block text-2xl font-semibold mb-6">⚙️ 设置</h1>

      {/* ---- Profile Card ---- */}
      <div className="bg-surface dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-6 mb-5">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-2xl font-semibold shrink-0 shadow-sm">
            {initials}
          </div>

          {/* Name & Email */}
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-gray-200 dark:border-slate-700 rounded-lg text-sm
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="输入昵称"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveNickname();
                    if (e.key === "Escape") setEditing(false);
                  }}
                />
                <button
                  onClick={handleSaveNickname}
                  disabled={saving}
                  className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 disabled:opacity-50 shrink-0"
                >
                  {saving ? "..." : "保存"}
                </button>
                <button
                  onClick={() => { setEditing(false); setNickname(profile?.display_name || ""); }}
                  className="px-3 py-1.5 border border-gray-200 dark:border-slate-700 text-xs rounded-lg hover:bg-gray-50 dark:bg-slate-800 shrink-0"
                >
                  取消
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-semibold truncate">{displayName}</h2>
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-0.5"
                >
                  编辑昵称
                </button>
              </>
            )}
            <p className="text-sm text-gray-500 dark:text-slate-400 truncate mt-0.5">{user.email}</p>
            {memberSince && (
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">🕐 {memberSince} 加入</p>
            )}
          </div>
        </div>
        {message && (
          <p className={`text-xs mt-3 ${message.includes("成功") ? "text-green-600" : "text-red-500"}`}>
            {message}
          </p>
        )}
      </div>

      {/* ---- Middle Section ---- */}
      <div className="space-y-3 mb-5">
        {/* Privacy / Encryption info */}
        <div className="bg-surface dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔐</span>
            <div>
              <h3 className="text-sm font-medium">数据加密</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                日记内容使用 AES-256-GCM 端到端加密，只有你的密码能解密
              </p>
            </div>
          </div>
        </div>

        {/* Sync status */}
        <div className="bg-surface dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">☁️</span>
            <div>
              <h3 className="text-sm font-medium">云端同步</h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                数据通过 Supabase 实时同步，电脑手机多端共享
              </p>
            </div>
            <span className="ml-auto inline-flex items-center gap-1 text-xs text-green-600">
              <span className="w-2 h-2 rounded-full bg-green-500" />在线
            </span>
          </div>
        </div>

        {/* Theme toggle */}
        <div className="bg-surface dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">{theme === "dark" ? "🌙" : "☀️"}</span>
              <div>
                <h3 className="text-sm font-medium">外观主题</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  {theme === "dark" ? "深色模式" : "浅色模式"}
                </p>
              </div>
            </div>
            <button
              onClick={toggle}
              className={`relative w-14 h-8 rounded-full transition-colors duration-200 shrink-0 overflow-hidden ${
                theme === "dark" ? "bg-blue-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all duration-200 ${
                  theme === "dark" ? "left-[calc(100%-28px)]" : "left-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ---- PWA Install ---- */}
      <div className="mb-5">
        <InstallPrompt />
      </div>

      {/* ---- Sign Out ---- */}
      <button
        disabled={signingOut}
        onClick={handleSignOut}
        className="w-full py-3 text-sm font-medium text-red-500 bg-red-50 rounded-xl
          hover:bg-red-100 transition-colors disabled:opacity-50"
      >
        {signingOut ? "退出中..." : "🚪 退出登录"}
      </button>
    </div>
  );
}
