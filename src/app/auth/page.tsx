"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AuthPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<string | null>(null);

  // 诊断：测试 Supabase 连接
  async function testConnection() {
    setNetworkStatus("测试中...");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`,
        { method: "HEAD" }
      );
      setNetworkStatus(res.ok ? "✅ Supabase 连接正常" : `⚠️ 响应 ${res.status}`);
    } catch (e: any) {
      setNetworkStatus(`❌ 网络不通: ${e.message || String(e)}`);
    }
  }

  // 已登录则跳转首页
  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("请填写邮箱和密码");
      return;
    }
    if (password.length < 6) {
      setError("密码至少 6 位");
      return;
    }

    setSubmitting(true);
    const result = isLogin ? await signIn(email, password) : await signUp(email, password);
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
    } else if (!isLogin) {
      setError(null);
      setIsLogin(true);
      setError("注册成功！请查看邮箱确认链接，或直接登录。");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900">
        <div className="text-gray-500 dark:text-slate-400">加载中...</div>
      </div>
    );
  }

  if (user) return null; // 即将跳转

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-gray-800 dark:text-slate-200 mb-1">
            ⏳ 时光轴
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            记录生活，看见时间的形状
          </p>
        </div>

        {/* Network diagnosis */}
        <div className="mb-4 text-center">
          <button
            type="button"
            onClick={testConnection}
            className="text-xs text-gray-400 dark:text-slate-500 hover:text-blue-600 dark:text-blue-400 underline"
          >
            检测网络连接
          </button>
          {networkStatus && (
            <p className="text-xs mt-1 text-gray-500 dark:text-slate-400">{networkStatus}</p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1.5">
              邮箱
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-slate-400 mb-1.5">
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位"
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-lg text-sm
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoComplete={isLogin ? "current-password" : "new-password"}
            />
          </div>

          {error && (
            <div
              className={`text-sm px-3 py-2 rounded-lg ${
                error.includes("成功")
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-600"
              }`}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-blue-500 text-white text-sm font-medium rounded-lg
              hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {submitting ? "处理中..." : isLogin ? "登录" : "注册"}
          </button>
        </form>

        {/* Toggle */}
        <div className="text-center mt-6">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {isLogin ? "没有账号？去注册" : "已有账号？去登录"}
          </button>
        </div>
      </div>
    </div>
  );
}
