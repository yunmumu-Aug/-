"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";
import type { Profile } from "@/types";

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  loading: true,
  signUp: async () => ({ error: "未初始化" }),
  signIn: async () => ({ error: "未初始化" }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // 初始化：获取当前 session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      setProfile(data);
    } catch {
      // Profile 可能还未创建（触发器延迟）
    }
  }

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        // 打印完整 error 对象，Supabase 的 error 有 __isAuthError 标记
        console.log("SignUp error object:", error);
        console.log("SignUp error keys:", Object.keys(error));
        console.log("SignUp error status:", (error as any).status);
        console.log("SignUp error code:", (error as any).code);
        console.log("SignUp error name:", (error as any).name);
        console.log("SignUp error message:", (error as any).message);
        // @ts-expect-error Supabase AuthError 可能有 cause 属性
        console.log("SignUp error cause:", error.cause);
        return { error: error.message || JSON.stringify(error, Object.getOwnPropertyNames(error)) };
      }
      if (data?.user && !data?.session) {
        return { error: "注册请求已提交，请查看邮箱中的确认链接。如果没有收到邮件，请检查垃圾箱。确认后即可登录。" };
      }
      return { error: null };
    } catch (e: unknown) {
      console.log("SignUp raw exception:", e);
      // @ts-expect-error 检查 Supabase AuthError 的特殊属性
      console.log("Exception constructor:", e?.constructor?.name);
      // @ts-expect-error
      console.log("Exception props:", Object.getOwnPropertyNames(e));
      const err = e as any;
      // Supabase Auth 错误有时放在 err.originalError 里
      const msg = err?.message || err?.msg || err?.originalError?.message || JSON.stringify(err) || "注册失败";
      return { error: msg };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        console.error("SignIn error:", error);
        return { error: error.message || JSON.stringify(error) };
      }
      return { error: null };
    } catch (e: unknown) {
      const err = e as Error;
      console.error("SignIn exception:", e);
      return { error: err?.message || String(e) || "登录失败" };
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
    router.push("/auth");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{ user, profile, session, loading, signUp, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
