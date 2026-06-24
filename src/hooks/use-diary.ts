"use client";

import { useState, useCallback } from "react";
import { useAuth } from "./use-auth";
import type { Diary, Tag } from "@/types";

/**
 * 日记相关数据操作 hook
 */
export function useDiary() {
  const { session } = useAuth();
  const [saving, setSaving] = useState(false);

  const getAuthHeaders = useCallback(() => {
    return {
      Authorization: `Bearer ${session?.access_token || ""}`,
      "Content-Type": "application/json",
    };
  }, [session?.access_token]);

  // 获取某天日记
  const getDiary = useCallback(async (date: string): Promise<Diary | null> => {
    if (!session?.access_token) return null;
    const res = await fetch(`/api/diaries?date=${date}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const json = await res.json();
    return json.data || null;
  }, [session?.access_token]);

  // 获取日期范围的日记
  const getDiaries = useCallback(async (start: string, end: string): Promise<Diary[]> => {
    if (!session?.access_token) return [];
    const res = await fetch(`/api/diaries?start=${start}&end=${end}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const json = await res.json();
    return json.data || [];
  }, [session?.access_token]);

  // 保存日记
  const saveDiary = useCallback(async (data: {
    date: string;
    content: string;
    wakeTime: string;
    sleepTime: string;
    tags: Array<{ tagId: string; timeLabel: string | null }>;
  }): Promise<Diary | null> => {
    if (!session?.access_token) return null;
    setSaving(true);
    try {
      const res = await fetch("/api/diaries", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      return json.data;
    } finally {
      setSaving(false);
    }
  }, [session?.access_token, getAuthHeaders]);

  return { getDiary, getDiaries, saveDiary, saving };
}

/**
 * 标签相关数据操作 hook
 */
export function useTags() {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);

  const getAuthHeaders = useCallback(() => {
    return {
      Authorization: `Bearer ${session?.access_token || ""}`,
      "Content-Type": "application/json",
    };
  }, [session?.access_token]);

  // 获取所有标签
  const getTags = useCallback(async (): Promise<Tag[]> => {
    if (!session?.access_token) return [];
    const res = await fetch("/api/tags", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const json = await res.json();
    return json.data || [];
  }, [session?.access_token]);

  // 创建标签
  const createTag = useCallback(async (name: string, color?: string): Promise<Tag | null> => {
    if (!session?.access_token) return null;
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, color }),
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json.data;
  }, [session?.access_token, getAuthHeaders]);

  // 批量导入标签
  const batchImportTags = useCallback(async (names: string[]): Promise<Tag[]> => {
    if (!session?.access_token) return [];
    setLoading(true);
    try {
      const res = await fetch("/api/tags/batch", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ names }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      return json.data || [];
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, getAuthHeaders]);

  return { getTags, createTag, batchImportTags, loading };
}
