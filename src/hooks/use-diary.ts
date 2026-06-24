"use client";

import { useState, useCallback } from "react";
import { useAuth } from "./use-auth";
import { supabase } from "@/lib/supabase";
import { encrypt, decrypt } from "@/lib/crypto";
import type { Diary, Tag } from "@/types";

/** 尝试解密日记内容，如果无 iv 则视为明文 */
async function decryptDiary(diary: Diary | null, getKey: () => Promise<CryptoKey | null>): Promise<Diary | null> {
  if (!diary) return null;
  if (!diary.content_iv || !diary.content) return diary; // 明文或无内容
  const key = await getKey();
  if (!key) return diary; // 无密钥，返回密文（用户需重新登录）
  diary.content = await decrypt(diary.content, diary.content_iv, key);
  return diary;
}

async function decryptDiaries(diaries: Diary[], getKey: () => Promise<CryptoKey | null>): Promise<Diary[]> {
  const key = await getKey();
  if (!key) return diaries;
  return Promise.all(diaries.map(async (d) => {
    if (d.content_iv && d.content) {
      d.content = await decrypt(d.content, d.content_iv, key);
    }
    return d;
  }));
}

export function useDiary() {
  const { session, getEncKey } = useAuth();
  const [saving, setSaving] = useState(false);

  // 获取某天日记
  const getDiary = useCallback(async (date: string): Promise<Diary | null> => {
    if (!session?.user?.id) return null;
    const { data, error, status } = await supabase
      .from("diaries")
      .select("*, tags:diary_tags(id, tag_id, time_label, position, tag:tags(id, name, color))")
      .eq("user_id", session.user.id)
      .eq("date", date)
      .maybeSingle();
    if (error && status !== 406) return null;
    return decryptDiary(data, getEncKey);
  }, [session?.user?.id, getEncKey]);

  // 获取日期范围的日记
  const getDiaries = useCallback(async (start: string, end: string): Promise<Diary[]> => {
    if (!session?.user?.id) return [];
    const { data, error } = await supabase
      .from("diaries")
      .select("*, tags:diary_tags(id, tag_id, time_label, position, tag:tags(id, name, color))")
      .eq("user_id", session.user.id)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true });
    if (error) return [];
    return decryptDiaries(data || [], getEncKey);
  }, [session?.user?.id, getEncKey]);

  // 保存日记
  const saveDiary = useCallback(async (params: {
    date: string;
    content: string;
    wakeTime: string;
    sleepTime: string;
    tags: Array<{ tagId: string; timeLabel: string | null }>;
  }): Promise<Diary | null> => {
    if (!session?.user?.id) return null;
    setSaving(true);
    try {
      // 加密内容
      const key = await getEncKey();
      let encryptedContent = params.content || "";
      let iv: string | null = null;
      if (key && params.content.trim()) {
        const result = await encrypt(params.content, key);
        encryptedContent = result.ciphertext;
        iv = result.iv;
      }

      const { data: diary, error: diaryError } = await supabase
        .from("diaries")
        .upsert({
          user_id: session.user.id,
          date: params.date,
          content: encryptedContent,
          content_iv: iv,
          wake_time: params.wakeTime || null,
          sleep_time: params.sleepTime || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,date" })
        .select()
        .single();

      if (diaryError) throw diaryError;

      if (params.tags) {
        await supabase.from("diary_tags").delete().eq("diary_id", diary.id);
        if (params.tags.length > 0) {
          const rows = params.tags.map((t, idx) => ({
            diary_id: diary.id,
            tag_id: t.tagId,
            time_label: t.timeLabel || null,
            position: idx,
          }));
          await supabase.from("diary_tags").insert(rows);
        }
      }

      const { data: full } = await supabase
        .from("diaries")
        .select("*, tags:diary_tags(id, tag_id, time_label, position, tag:tags(id, name, color))")
        .eq("id", diary.id)
        .single();

      return decryptDiary(full, getEncKey);
    } catch (e: any) {
      console.error("saveDiary error:", e);
      throw e;
    } finally {
      setSaving(false);
    }
  }, [session?.user?.id, getEncKey]);

  return { getDiary, getDiaries, saveDiary, saving };
}

export function useTags() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);

  const getTags = useCallback(async (): Promise<Tag[]> => {
    if (!session?.user?.id) return [];
    const { data, error } = await supabase
      .from("tags")
      .select("*")
      .eq("user_id", session.user.id)
      .order("name");
    if (error) return [];
    return data || [];
  }, [session?.user?.id]);

  const createTag = useCallback(async (name: string, color?: string): Promise<Tag | null> => {
    if (!session?.user?.id) return null;
    const COLORS = ["#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#6366F1","#F97316"];
    const { data, error } = await supabase
      .from("tags")
      .insert({ user_id: session.user.id, name: name.trim(), color: color || COLORS[Math.floor(Math.random() * COLORS.length)] })
      .select()
      .single();
    if (error) { if (error.code === "23505") throw new Error("标签已存在"); throw error; }
    return data;
  }, [session?.user?.id]);

  const batchImportTags = useCallback(async (names: string[]): Promise<Tag[]> => {
    if (!session?.user?.id) return [];
    setLoading(true);
    try {
      const unique = [...new Set(names.map(n => n.trim()).filter(Boolean))];
      if (unique.length === 0) return [];
      const rows = unique.map(n => ({ user_id: session?.user?.id!, name: n, color: "#3B82F6" }));
      await supabase.from("tags").upsert(rows, { onConflict: "user_id,name", ignoreDuplicates: true });
      return getTags();
    } finally { setLoading(false); }
  }, [session?.user?.id, getTags]);

  const updateTag = useCallback(async (id: string, updates: { name?: string; color?: string }) => {
    if (!session?.user?.id) return;
    await supabase.from("tags").update(updates).eq("id", id).eq("user_id", session.user.id);
  }, [session?.user?.id]);

  const deleteTag = useCallback(async (id: string) => {
    if (!session?.user?.id) return;
    await supabase.from("diary_tags").delete().eq("tag_id", id);
    await supabase.from("tags").delete().eq("id", id).eq("user_id", session.user.id);
  }, [session?.user?.id]);

  return { getTags, createTag, batchImportTags, updateTag, deleteTag, loading };
}
