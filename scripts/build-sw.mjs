/**
 * 构建时注入 Service Worker 预缓存清单
 *
 * 不依赖 workbox-build，直接扫描 out/ 生成文件列表。
 * 然后注入到 sw.template.js → public/sw.js
 *
 * 用法: node scripts/build-sw.mjs
 */
import { readFileSync, writeFileSync, existsSync, cpSync, statSync, readdirSync } from "fs";
import { resolve, dirname, join, relative } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT = resolve(ROOT, "out");
const SRC_TEMPLATE = resolve(ROOT, "public", "sw.template.js");
const DEST_SW = resolve(ROOT, "public", "sw.js");
const DEST_OUT_SW = resolve(ROOT, "out", "sw.js");

// 不需要预缓存的文件
const IGNORE = new Set([
  "sw.js",
  "sw.template.js",
  "404.html",
  "_not-found.html",
  "workbox-*.js",
]);

// 需要预缓存的文件扩展名
const CACHE_EXTS = new Set([
  ".html",
  ".js",
  ".css",
  ".png",
  ".svg",
  ".ico",
  ".json",
  ".woff2",
  ".woff",
  ".ttf",
  ".eot",
]);

function walkDir(dir, baseDir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(fullPath, baseDir));
    } else if (entry.isFile()) {
      const relPath = relative(baseDir, fullPath).replace(/\\/g, "/");
      if (IGNORE.has(relPath) || IGNORE.has(entry.name)) continue;
      const ext = relPath.substring(relPath.lastIndexOf(".")).toLowerCase();
      if (CACHE_EXTS.has(ext)) {
        files.push(relPath);
      }
    }
  }
  return files.sort();
}

function main() {
  if (!existsSync(OUT)) {
    console.error("❌ 找不到 out/ 目录。请先运行 next build。");
    process.exit(1);
  }

  console.log("🔧 扫描静态文件...");
  const files = walkDir(OUT, OUT);
  console.log(`  📄 发现 ${files.length} 个文件`);

  // 最大文件数打印
  if (files.length > 0) {
    console.log(`  前 5 个: ${files.slice(0, 5).join(", ")}`);
    console.log(`  后 5 个: ${files.slice(-5).join(", ")}`);
  }

  // 生成 JS 数组字符串
  const fileListStr = files
    .map((f) => `"${f}"`)
    .join(",\n  ");

  console.log("\n🔧 注入预缓存清单到 SW...");
  const template = readFileSync(SRC_TEMPLATE, "utf-8");

  // 替换占位符 self.__WB_MANIFEST = [];
  const injected = template.replace(
    'self.__WB_MANIFEST = []',
    `self.__WB_MANIFEST = [\n  ${fileListStr}\n]`
  );

  writeFileSync(DEST_SW, injected, "utf-8");
  console.log(`  ✅ ${DEST_SW}`);

  // 复制到 out/
  cpSync(DEST_SW, DEST_OUT_SW, { force: true });
  console.log(`  ✅ ${DEST_OUT_SW}`);

  console.log(`\n🎉 SW 生成完成！共 ${files.length} 个文件预缓存`);
}

main();
