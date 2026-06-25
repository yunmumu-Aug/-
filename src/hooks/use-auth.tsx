"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { deriveKey, clearKey, getKey } from "@/lib/crypto";
import type { User, Session } from "@supabase/supabase-js";
import type { Profile } from "@/types";

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  hasKey: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  getEncKey: () => Promise<CryptoKey | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  loading: true,
  hasKey: false,
  signUp: async () => ({ error: "未初始化" }),
  signIn: async () => ({ error: "未初始化" }),
  signOut: async () => {},
  getEncKey: async () => null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasKey, setHasKey] = useState(false);
  const router = useRouter();

  // 不在 mount 时从 sessionStorage 恢复 hasKey ——
  // CryptoKey 不可序列化，浏览器重启后必定丢失。
  // hasKey 只在登录/注册时主动设为 true。

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) fetchProfile(session.user.id);
        else setProfile(null);
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
    } catch {}
  }

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return { error: error.message };
      // 提前派生密钥，即使还没确认邮箱
      try { await deriveKey(email, password); setHasKey(true); } catch {}
      if (data?.user && !data?.session) {
        return { error: "注册请求已提交，请查看邮箱中的确认链接" };
      }
      return { error: null };
    } catch (e: unknown) {
      return { error: (e as Error)?.message || "注册失败" };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      // 派生加密密钥
      try { await deriveKey(email, password); setHasKey(true); } catch {}
      return { error: null };
    } catch (e: unknown) {
      return { error: (e as Error)?.message || "登录失败" };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("SignOut error:", e);
    }
    // 无论成功失败都清理本地状态
    clearKey();
    setHasKey(false);
    setUser(null);
    setProfile(null);
    setSession(null);
    router.push("/auth");
  }, [router]);

  const getEncKey = useCallback(async (): Promise<CryptoKey | null> => {
    return getKey();
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, profile, session, loading, hasKey, signUp, signIn, signOut, getEncKey }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
