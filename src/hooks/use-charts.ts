"use client";

import { useState, useEffect } from "react";
import { useAuth } from "./use-auth";
import { supabase } from "@/lib/supabase";
import type { Diary, TagStat, SummaryCard } from "@/types";
import { aggregateTagStats, generateSummary } from "@/lib/chart-utils";
import { calcSleepDuration } from "@/lib/diary-utils";

interface ChartData {
  diaries: Diary[];
  tagStats: TagStat[];
  sleepData: SleepEntry[];
  summary: SummaryCard | null;
  loading: boolean;
}

interface SleepEntry {
  date: string;
  wakeTime: string | null;
  sleepTime: string | null;
  durationHours: number | null;
}

export function useChartData(start: string, end: string): ChartData {
  const { session } = useAuth();
  const [diaries, setDiaries] = useState<Diary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("diaries")
      .select("*, tags:diary_tags(id, tag_id, time_label, position, tag:tags(id, name, color))")
      .eq("user_id", session.user.id)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { console.error(error); setDiaries([]); }
        else setDiaries(data || []);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [start, end, session?.user?.id]);

  const tagStats = aggregateTagStats(diaries, []);
  const sleepData: SleepEntry[] = diaries.map(d => ({
    date: d.date, wakeTime: d.wake_time, sleepTime: d.sleep_time,
    durationHours: calcSleepDuration(d.wake_time, d.sleep_time),
  }));
  const summary = diaries.length > 0 ? generateSummary(diaries, tagStats) : null;
  return { diaries, tagStats, sleepData, summary, loading };
}
