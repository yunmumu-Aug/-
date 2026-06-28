/**
 * 构建时注入 Service Worker 预缓存清单（workbox-build）
 *
 * 工作流程:
 *   1. next build 输出静态文件到 out/
 *   2. 扫描 out/ 下所有客户端资源
 *   3. 将文件列表注入到 sw.template.js → public/sw.js
 *   4. public/ 下的 sw.js 在 next build 时自动被复制到 out/
 *
 * 用法: node scripts/build-sw.mjs
 */
import { injectManifest } from "workbox-build";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

async function main() {
  console.log("🔧 生成 Service Worker（注入预缓存清单）...");

  const result = await injectManifest({
    // 扫描目录：Next.js 静态导出输出
    globDirectory: resolve(ROOT, "out"),

    // 包含所有构建产物（HTML/JS/CSS 由 Next 管理，图片等静态资源）
    globPatterns: [
      "**/*.{html,js,css,png,svg,ico,json,woff2,woff,ttf,eot}",
    ],

    // 排除 service worker 本身（避免循环引用）
    globIgnores: ["sw.js", "sw.template.js", "workbox-*.js"],

    // 模板文件：包含 __WB_MANIFEST 占位符
    swSrc: resolve(ROOT, "public", "sw.template.js"),

    // 输出文件：生成到 public/ 下，next build 会自动复制到 out/
    swDest: resolve(ROOT, "public", "sw.js"),

    // 最大文件大小（字节）— 25MB，默认 2MB 可能不够
    maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,
  });

  console.log(`  ✅ 预缓存清单注入完成`);
  console.log(`  📦 共 ${result.count} 个文件，总大小 ${formatBytes(result.size)}`);

  // 同时将 sw.js 复制到 out/（确保部署时存在）
  const { cpSync } = await import("fs");
  cpSync(
    resolve(ROOT, "public", "sw.js"),
    resolve(ROOT, "out", "sw.js"),
    { force: true }
  );
  console.log(`  📋 已复制到 out/sw.js`);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

main().catch((err) => {
  console.error("❌ SW 生成失败:", err);
  process.exit(1);
});
