"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useTags } from "@/hooks/use-diary";
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

export default function TagsPage() {
  const { user, loading: authLoading } = useAuth();
  const { getTags, createTag, batchImportTags, updateTag, deleteTag } = useTags();
  const router = useRouter();

  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("random");
  const [batchInput, setBatchInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

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
      setMessage("❌ 加载标签失败");
    }
    setLoading(false);
  }, [user, getTags]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  // 创建标签
  async function handleCreate() {
    if (!newName.trim()) {
      setMessage("❌ 请输入标签名");
      return;
    }
    try {
      await createTag(newName.trim(), newColor === "random" ? undefined : newColor);
      setNewName("");
      setMessage("✅ 标签已创建");
      loadTags();
    } catch (e: any) {
      setMessage(`❌ ${e.message}`);
    }
    setTimeout(() => setMessage(null), 2000);
  }

  // 批量导入
  async function handleBatchImport() {
    if (!batchInput.trim()) {
      setMessage("❌ 请输入标签名");
      return;
    }
    const names = batchInput
      .split(/[,，\n]/)
      .map((n) => n.trim())
      .filter(Boolean);

    if (names.length === 0) {
      setMessage("❌ 未识别到有效标签名");
      return;
    }

    try {
      const result = await batchImportTags(names);
      setTags(result);
      setBatchInput("");
      setMessage(`✅ 成功导入 ${names.length} 个标签`);
    } catch (e: any) {
      setMessage(`❌ ${e.message}`);
    }
    setTimeout(() => setMessage(null), 2500);
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
      setMessage("✅ 预设标签初始化完成");
      loadTags();
    } catch (e: any) {
      setMessage(`❌ ${e.message}`);
    }
    setTimeout(() => setMessage(null), 2000);
  }

  // 删除标签
  async function handleDelete(tagId: string) {
    setDeleting(tagId);
    try {
      await deleteTag(tagId);
      setTags((prev) => prev.filter((t) => t.id !== tagId));
      setMessage("✅ 标签已删除");
    } catch (e: any) {
      setMessage(`❌ ${e.message}`);
    }
    setDeleting(null);
    setTimeout(() => setMessage(null), 2000);
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-[var(--text-secondary)]">加载中...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">
      <h1 className="text-2xl font-semibold mb-6">🏷️ 标签管理</h1>

      {message && (
        <div
          className={`mb-4 px-4 py-2 rounded-lg text-sm ${
            message.startsWith("✅")
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-600"
          }`}
        >
          {message}
        </div>
      )}

      {/* 创建标签 */}
      <section className="mb-8 p-4 bg-[var(--muted)] rounded-xl border border-[var(--border)]">
        <h2 className="text-sm font-medium mb-3">新建标签</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="标签名"
            className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg text-sm
              focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <div className="flex gap-1.5 items-center">
            {/* Random */}
            <button
              onClick={() => setNewColor("random")}
              className={`w-7 h-7 rounded-full border-2 transition-transform flex items-center justify-center
                bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400
                ${newColor === "random" ? "border-gray-800 scale-110" : "border-transparent"}`}
              title="随机颜色"
            >
              <span className="text-[10px]">🎲</span>
            </button>
            {/* Preset colors */}
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                  newColor === c ? "border-gray-800 scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
            {/* Custom color input */}
            <label className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer flex items-center justify-center
              bg-white ${!["random", ...COLORS].includes(newColor) ? "border-gray-800 scale-110" : "border-gray-300"}`}
              title="自定颜色"
            >
              <span className="text-[10px]">＋</span>
              <input
                type="color"
                value={newColor === "random" ? "#3B82F6" : newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="absolute opacity-0 w-0 h-0"
              />
            </label>
          </div>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg
              hover:bg-[var(--accent-hover)] transition-colors shrink-0"
          >
            创建
          </button>
        </div>
      </section>

      {/* 批量导入 */}
      <section className="mb-8 p-4 bg-[var(--muted)] rounded-xl border border-[var(--border)]">
        <h2 className="text-sm font-medium mb-3">批量导入标签</h2>
        <textarea
          value={batchInput}
          onChange={(e) => setBatchInput(e.target.value)}
          placeholder="每行一个标签名，或用逗号分隔&#10;例如：&#10;运动, 阅读, 冥想&#10;写作&#10;画画"
          rows={4}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm resize-y mb-2
            focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
        />
        <div className="flex gap-2">
          <button
            onClick={handleBatchImport}
            className="px-4 py-2 bg-[var(--accent)] text-white text-sm font-medium rounded-lg
              hover:bg-[var(--accent-hover)] transition-colors"
          >
            导入
          </button>
          <button
            onClick={handleInitPresets}
            className="px-4 py-2 border border-[var(--border)] text-sm font-medium rounded-lg
              hover:bg-[var(--muted)] transition-colors"
          >
            初始化预设标签
          </button>
        </div>
      </section>

      {/* 标签列表 */}
      <section>
        <h2 className="text-sm font-medium mb-3 text-[var(--text-secondary)]">
          已有标签（{tags.length} 个）
        </h2>
        {loading ? (
          <p className="text-sm text-[var(--text-muted)]">加载中...</p>
        ) : tags.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            还没有标签，创建或导入你的第一个标签吧
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center justify-between p-3 bg-white border border-[var(--border)]
                  rounded-lg hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-sm truncate">{tag.name}</span>
                </div>
                <button
                  onClick={() => handleDelete(tag.id)}
                  disabled={deleting === tag.id}
                  className="ml-2 text-xs text-[var(--text-muted)] hover:text-red-500 shrink-0
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
