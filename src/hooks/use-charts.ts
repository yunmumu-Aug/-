"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./use-auth";
import type { Diary, TagStat, SummaryCard } from "@/types";
import { aggregateTagStats, generateSummary, generateHeatmapData } from "@/lib/chart-utils";
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
    if (!session?.access_token || !start || !end) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`/api/diaries?start=${start}&end=${end}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const list: Diary[] = Array.isArray(json.data) ? json.data : (json.data ? [json.data] : []);
        setDiaries(list);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [start, end, session?.access_token]);

  const tagStats = aggregateTagStats(diaries, []);
  const sleepData: SleepEntry[] = diaries.map((d) => ({
    date: d.date,
    wakeTime: d.wake_time,
    sleepTime: d.sleep_time,
    durationHours: calcSleepDuration(d.wake_time, d.sleep_time),
  }));
  const summary = diaries.length > 0 ? generateSummary(diaries, tagStats) : null;

  return { diaries, tagStats, sleepData, summary, loading };
}
