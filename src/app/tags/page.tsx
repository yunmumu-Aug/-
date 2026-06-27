"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useTags } from "@/hooks/use-diary";
import { supabase } from "@/lib/supabase";
import type { Tag } from "@/types";

const PRESET_TAGS = [
  { name: "起床", color: "#10B981" },
  { name: "睡觉", color: "#6366F1" },
  { name: "吃饭", color: "#F59E0B" },
  { name: "工作", color: "#3B82F6" },
  { name: "运动", color: "#EF4444" },
  { name: "学习", color: "#8B5CF6" },
  { name: "娱乐", color: "#EC4899" },
  { name: "其他", color: "#6B7280" },
];

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#6366F1"];

const FIXED_COLORS = ["#FF4757","#FF6B81","#FFA502","#E8C07A","#2ED573","#7BED9F","#1E90FF","#70A1FF","#A29BFE","#6C5CE7","#FD79A8","#C44569","#57606F","#747D8C","#2F3542","#F1F2F6","#ECF0F1","#B2BEC3"];

// ── 颜色轮盘（Pointer Events 即时拖拽） ──
function ColorWheel({ value, onChange, onClose }: { value: string; onChange: (c: string) => void; onClose: () => void }) {
  const [hue, setHue] = useState(210);
  const [bri, setBri] = useState(60);
  const [dragging, setDragging] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("tag-recent-colors") || "[]"); }
    catch { return []; }
  });
  const elRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const briRef = useRef(bri);
  briRef.current = bri;

  const hex = hslToHex(hue, 80, bri);

  useEffect(() => {
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
      const r2 = parseInt(value.slice(1, 3), 16) / 255;
      const g = parseInt(value.slice(3, 5), 16) / 255;
      const b = parseInt(value.slice(5, 7), 16) / 255;
      const max = Math.max(r2, g, b), min = Math.min(r2, g, b);
      let h = 0, l = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r2: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
          case g: h = ((b - r2) / d + 2) * 60; break;
          case b: h = ((r2 - g) / d + 4) * 60; break;
        }
      }
      setHue(Math.round(h));
      setBri(Math.round(l * 100));
    }
  }, []);

  function updateColor(color: string) {
    onChange(color);
    setRecentColors(prev => {
      const next = [color, ...prev.filter(c => c !== color)].slice(0, 8);
      localStorage.setItem("tag-recent-colors", JSON.stringify(next));
      return next;
    });
  }

  function moveDot(clientX: number, clientY: number) {
    const el = elRef.current;
    const dt = dotRef.current;
    if (!el || !dt) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    const dx = clientX - rect.left - cx;
    const dy = clientY - rect.top - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // 只在色环轨道区域和外部响应，内圈空白区域不响应
    if (dist < 25) return;
    // 把圆点钳制在环的中间半径（70px）位置上
    const angle = Math.atan2(dy, dx);
    const midR = 70;
    const fx = cx + midR * Math.cos(angle);
    const fy = cy + midR * Math.sin(angle);
    dt.style.left = `${fx - 10}px`;
    dt.style.top = `${fy - 10}px`;
    // 计算颜色：atan2 0°=3点 → 转 conic 坐标系（+90°）
    let hueAngle = angle * 180 / Math.PI + 90;
    if (hueAngle < 0) hueAngle += 360;
    const h = Math.round(hueAngle % 360);
    const b = briRef.current;
    const c = hslToHex(h, 80, b);
    dt.style.backgroundColor = `#${c}`;
    setHue(h);
    onChange(`#${c}`);
  }

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
    moveDot(e.clientX, e.clientY);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    moveDot(e.clientX, e.clientY);
  }
  function onPointerUp() {
    if (dragging) {
      const c = `#${hex}`;
      setRecentColors(prev => {
        const next = [c, ...prev.filter(x => x !== c)].slice(0, 8);
        localStorage.setItem("tag-recent-colors", JSON.stringify(next));
        return next;
      });
    }
    setDragging(false);
  }

  function hslToHex(h: number, s: number, l: number): string {
    s /= 100; l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r2 = 0, g = 0, b = 0;
    if (h < 60) { r2 = c; g = x; }
    else if (h < 120) { r2 = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r2 = x; b = c; }
    else { r2 = c; b = x; }
    const he = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
    return `${he(r2)}${he(g)}${he(b)}`;
  }

  const midR = 70;
  const rad = ((hue - 90) * Math.PI) / 180;
  const dotX = 100 + midR * Math.cos(rad);
  const dotY = 100 + midR * Math.sin(rad);

  return (
    <div>
      <div ref={elRef} className="mx-auto relative select-none touch-none" style={{ width: 200, height: 200 }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <div className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: `conic-gradient(hsl(0,80%,${bri}%) 0deg,hsl(30,80%,${bri}%) 30deg,hsl(60,80%,${bri}%) 60deg,hsl(120,80%,${bri}%) 120deg,hsl(180,80%,${bri}%) 180deg,hsl(240,80%,${bri}%) 240deg,hsl(300,80%,${bri}%) 300deg,hsl(360,80%,${bri}%) 360deg)`,
            WebkitMask: "radial-gradient(circle at center, transparent 55%, black 56%)",
            mask: "radial-gradient(circle at center, transparent 55%, black 56%)",
          }}
        />
        <div className="absolute w-5 h-5 rounded-full bg-white dark:bg-slate-800 shadow-md pointer-events-none"
          style={{ left: 90, top: 90 }} />
        <div ref={dotRef}
          className="absolute w-5 h-5 rounded-full border-2 border-white shadow-md pointer-events-none"
          style={{ left: dotX - 10, top: dotY - 10, backgroundColor: `#${hex}` }} />
      </div>
      <div className="mt-3 flex items-center gap-2 px-1">
        <span className="text-[10px] text-gray-400 dark:text-slate-500 w-6">暗</span>
        <input type="range" min={10} max={100} value={bri}
          onChange={(e) => { const v = Number(e.target.value); setBri(v); onChange(`#${hslToHex(hue, 80, v)}`); }}
          className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
          style={{ background: `linear-gradient(to right, #000, hsl(${hue}, 80%, 50%))` }} />
        <span className="text-[10px] text-gray-400 dark:text-slate-500 w-6">亮</span>
      </div>
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100 dark:border-slate-700">
        <div className="w-6 h-6 rounded-full shrink-0 border border-gray-200" style={{ backgroundColor: `#${hex}` }} />
        <span className="text-[11px] font-mono font-semibold text-gray-600 dark:text-slate-300">#{hex}</span>
        <button type="button" onClick={onClose}
          className="ml-auto px-3 py-1 bg-blue-500 text-white text-xs font-medium rounded-lg hover:bg-blue-600 transition-colors">确定</button>
      </div>
      {/* 最近使用 */}
      {recentColors.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-700">
          <div className="text-[10px] text-gray-400 dark:text-slate-500 mb-1">最近使用</div>
          <div className="flex flex-wrap gap-[5px]">
            {recentColors.map(c => (
              <button key={c} type="button" onClick={() => { updateColor(c); }}
                className={`w-[18px] h-[18px] rounded-full transition-transform hover:scale-110 shrink-0 ${value === c ? "ring-2 ring-gray-800 scale-110" : ""}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
      )}
      {/* 推荐色 */}
      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-slate-700">
        <div className="text-[10px] text-gray-400 dark:text-slate-500 mb-1">推荐色</div>
        <div className="grid grid-cols-9 gap-[5px]">
          {FIXED_COLORS.map(c => (
            <button key={c} type="button" onClick={() => { updateColor(c); }}
              className={`w-full aspect-square rounded-full transition-transform hover:scale-110 ${value === c ? "ring-2 ring-gray-800 scale-110" : ""}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function TagsPage() {
  const { user, loading: authLoading } = useAuth();
  const { getTags, createTag, batchImportTags, updateTag, deleteTag } = useTags();
  const router = useRouter();

  const [tags, setTags] = useState<Tag[]>([]);
  const [tagUsage, setTagUsage] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("random");
  const [batchInput, setBatchInput] = useState("");
  const [messages, setMessages] = useState<Array<{ id: number; text: string; type: "success" | "error" | "warn" }>>([]);
  let msgId = useRef(0);
  function addMessage(text: string) {
    const id = ++msgId.current;
    let type: "success" | "error" | "warn" = "success";
    if (text.startsWith("❌")) type = "error";
    if (text.includes("删除")) type = "warn";
    setMessages(prev => [...prev, { id, text, type }]);
    setTimeout(() => setMessages(prev => prev.filter(m => m.id !== id)), 5000);
  }
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const isCustomColor = /^#[0-9a-fA-F]{6}$/.test(newColor);

  // 按使用次数排序的标签
  const sortedTags = useMemo(() => {
    return [...tags].sort((a, b) => (tagUsage.get(b.id) || 0) - (tagUsage.get(a.id) || 0));
  }, [tags, tagUsage]);

  // 未登录 → 跳转
  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth");
  }, [user, authLoading, router]);

  // 加载标签
  const loadTags = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getTags();
      setTags(data);
    } catch {
      addMessage("❌ 加载标签失败");
    }
    setLoading(false);
  }, [user, getTags]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  // 加载标签使用次数排名
  useEffect(() => {
    if (!user || tags.length === 0) return;
    (async () => {
      try {
        const { data } = await supabase.from("diary_tags").select("tag_id").in("tag_id", tags.map(t => t.id));
        const counts = new Map<string, number>();
        (data || []).forEach(dt => { counts.set(dt.tag_id, (counts.get(dt.tag_id) || 0) + 1); });
        setTagUsage(counts);
      } catch {}
    })();
  }, [user, tags]);


  // 桌面端点击外部关闭颜色选择器
  useEffect(() => {
    if (!showColorPicker) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.color-picker-wrap')) setShowColorPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showColorPicker]);

  // 创建标签
  async function handleCreate() {
    if (!newName.trim()) {
      addMessage("❌ 请输入标签名");
      return;
    }
    try {
      await createTag(newName.trim(), newColor === "random" ? undefined : newColor);
      setNewName("");
      setNewColor("random");
      setShowColorPicker(false);
      addMessage("✅ 标签已创建");
      loadTags();
    } catch (e: any) {
      addMessage(`❌ ${e.message}`);
    }
    
  }

  // 批量导入
  async function handleBatchImport() {
    if (!batchInput.trim()) {
      addMessage("❌ 请输入标签名");
      return;
    }
    const names = batchInput
      .split(/[,，\n]/)
      .map((n) => n.trim())
      .filter(Boolean);

    if (names.length === 0) {
      addMessage("❌ 未识别到有效标签名");
      return;
    }

    try {
      const result = await batchImportTags(names);
      setTags(result);
      setBatchInput("");
      addMessage(`✅ 成功导入 ${names.length} 个标签`);
    } catch (e: any) {
      addMessage(`❌ ${e.message}`);
    }
    
  }

  // 初始化预设标签
  async function handleInitPresets() {
    try {
      await batchImportTags(PRESET_TAGS.map((t) => t.name));
      const allTags = await getTags();
      for (const preset of PRESET_TAGS) {
        const tag = allTags.find((t: Tag) => t.name === preset.name);
        if (tag && tag.color !== preset.color) {
          try { await updateTag(tag.id, { color: preset.color }); } catch {}
        }
      }
      addMessage("✅ 预设标签初始化完成");
      loadTags();
    } catch (e: any) {
      addMessage(`❌ ${e.message}`);
    }
    
  }

  // 删除标签
  async function handleDelete(tagId: string) {
    setDeleting(tagId);
    try {
      await deleteTag(tagId);
      setTags((prev) => prev.filter((t) => t.id !== tagId));
      addMessage("✅ 标签已删除");
    } catch (e: any) {
      addMessage(`❌ ${e.message}`);
    }
    setDeleting(null);
    
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500 dark:text-slate-400">加载中...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 pt-0 pb-6 md:py-8">
      {/* 手机页头 */}
      <div className="lg:hidden mb-4 bg-white dark:bg-slate-800 -mx-4 px-4 py-3">
        <div className="flex items-center justify-center gap-2">
          <span className="text-lg">🏷️</span>
          <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">标签管理</span>
        </div>
      </div>
      <h1 className="hidden lg:block text-2xl font-semibold mb-6">🏷️ 标签管理</h1>

      {messages.length > 0 && createPortal(
        <div className="fixed top-16 right-4 z-[9999] flex flex-col gap-2 max-w-[300px] mt-2">
          {messages.map(m => (
            <div key={m.id}
              className={`px-4 py-3 mx-4 rounded-xl shadow-lg text-sm font-medium transition-all duration-300 border
                ${m.type === "success"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : m.type === "warn"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-red-50 text-red-600 border-red-200"}`}
            >
              {m.text}
            </div>
          ))}
        </div>,
        document.body
      )}

      {/* 创建标签 */}
      <section className="mb-8 p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
        <h2 className="text-sm font-medium mb-3">新建标签</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="标签名"
            className="flex-1 px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <div className="flex gap-1.5 items-center relative">
            {/* Random */}
            <button
              onClick={() => setNewColor("random")}
              className={`w-7 h-7 rounded-full transition-transform flex items-center justify-center
                bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400
                ${newColor === "random" ? "ring-2 ring-gray-800 scale-110" : ""}`}
              title="随机颜色"
            >
              <span className="text-base leading-none">🎲</span>
            </button>
            {/* Preset colors */}
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={`w-7 h-7 rounded-full transition-transform ${
                  newColor === c ? "ring-2 ring-gray-800 scale-110" : ""
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
            {/* Custom color input */}
            <span className="color-picker-wrap relative inline-flex">
              <button type="button" onClick={() => setShowColorPicker(v => !v)}
                className={`w-7 h-7 rounded-full transition-transform flex items-center justify-center ${
                  isCustomColor || showColorPicker ? "ring-2 ring-gray-500 scale-110" : "bg-white dark:bg-slate-800 ring-1 ring-gray-300 dark:ring-slate-600"
                }`}
                title="自定颜色"
                style={isCustomColor ? { backgroundColor: newColor } : {}}>
                {!isCustomColor && <span className="text-sm font-bold text-gray-500 dark:text-slate-400">＋</span>}
              </button>
              {showColorPicker && (
                <>
                  {/* 手机端全屏遮罩 */}
                  <div className="md:hidden fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setShowColorPicker(false)}>
                    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-lg p-4 w-64" onClick={e => e.stopPropagation()}>
                      <ColorWheel value={newColor} onChange={setNewColor} onClose={() => setShowColorPicker(false)} />
                    </div>
                  </div>
                  {/* 桌面端下拉定位 */}
                  <div className="hidden md:block absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg p-3 w-56" onClick={e => e.stopPropagation()}>
                    <ColorWheel value={newColor} onChange={setNewColor} onClose={() => setShowColorPicker(false)} />
                  </div>
                </>
              )}
            </span>
          </div>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg
              hover:bg-blue-600 transition-colors shrink-0"
          >
            创建
          </button>
        </div>
      </section>

      {/* 批量导入 */}
      <section className="mb-8 p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
        <h2 className="text-sm font-medium mb-3">批量导入标签</h2>
        <textarea
          value={batchInput}
          onChange={(e) => setBatchInput(e.target.value)}
          placeholder="每行一个标签名，或用逗号分隔&#10;例如：&#10;运动, 阅读, 冥想&#10;写作&#10;画画"
          rows={4}
          className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-lg text-sm resize-none mb-2
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="flex gap-2">
          <button
            onClick={handleBatchImport}
            className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg
              hover:bg-blue-600 transition-colors"
          >
            导入
          </button>
          <button
            onClick={handleInitPresets}
            className="px-4 py-2 border border-gray-200 dark:border-slate-700 text-sm font-medium rounded-lg
              hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            初始化预设标签
          </button>
        </div>
      </section>

      {/* 标签使用排行 */}
      <section className="mb-8 p-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl">
        <h2 className="text-sm font-medium mb-3">🏆 标签使用排行</h2>
        {loading ? (
          <p className="text-sm text-gray-400 dark:text-slate-500">加载中...</p>
        ) : sortedTags.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-slate-500">暂无数据</p>
        ) : (
          <div className="space-y-2">
            {sortedTags.slice(0, 10).map((tag, i) => {
              const maxCount = Math.max(1, ...sortedTags.slice(0, 10).map(t => tagUsage.get(t.id) || 0));
              const count = tagUsage.get(tag.id) || 0;
              return (
              <div key={tag.id} className="flex items-center gap-2 text-sm">
                <span className={`w-5 text-right text-xs font-bold shrink-0 ${i < 3 ? "text-blue-500" : "text-gray-400 dark:text-slate-500"}`}>
                  {i + 1}
                </span>
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                <span className="w-16 sm:w-20 truncate shrink-0">{tag.name}</span>
                <div className="flex-1 h-2.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${count > 0 ? Math.max(8, (count / maxCount) * 100) : 0}%`,
                    backgroundColor: tag.color,
                    opacity: 0.65,
                  }} />
                </div>
                <span className="text-xs text-gray-400 dark:text-slate-500 w-10 text-right shrink-0">{count}次</span>
              </div>
            );})}
          </div>
        )}
      </section>

      {/* 标签列表 */}
      <section>
        <h2 className="text-sm font-medium mb-3 text-gray-500 dark:text-slate-400">
          已有标签（{tags.length} 个）
        </h2>
        {loading ? (
          <p className="text-sm text-gray-400 dark:text-slate-500">加载中...</p>
        ) : tags.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-slate-500">
            还没有标签，创建或导入你的第一个标签吧
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {sortedTags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700
                  rounded-lg hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-sm truncate">{tag.name}</span>
                  <span className="text-[10px] text-gray-400 dark:text-slate-400 ml-auto">{tagUsage.get(tag.id) || 0}次</span>
                </div>
                <button
                  onClick={() => handleDelete(tag.id)}
                  disabled={deleting === tag.id}
                  className="ml-2 text-xs text-gray-400 dark:text-slate-500 hover:text-red-500 shrink-0
                    disabled:opacity-30 transition-colors"
                >
                  {deleting === tag.id ? "..." : "✕"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
