/**
 * 生成 PWA 所需的多尺寸 PNG 图标
 * 用法: node scripts/generate-pwa-icons.mjs
 */
import sharp from "sharp";
import { readFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(__dirname, "../public");

const SIZES = [192, 512];
const SVG_PATH = resolve(PUBLIC, "icon.svg");

async function main() {
  if (!existsSync(SVG_PATH)) {
    console.error("❌ 找不到 icon.svg:", SVG_PATH);
    process.exit(1);
  }

  const svgBuffer = readFileSync(SVG_PATH);
  const svgContent = svgBuffer.toString("utf-8");

  for (const size of SIZES) {
    const outPath = resolve(PUBLIC, `icon-${size}x${size}.png`);

    // sharp can read SVG directly
    await sharp(Buffer.from(svgContent))
      .resize(size, size, { fit: "contain", background: { r: 91, g: 141, b: 239 } })
      .png()
      .toFile(outPath);

    console.log(`  ✅ ${outPath} (${size}x${size})`);
  }

  // Also generate a maskable icon (with padding for adaptive icons)
  for (const size of SIZES) {
    const outPath = resolve(PUBLIC, `icon-${size}x${size}-maskable.png`);

    // Maskable: scale down to 80% for safe area (padding around the icon)
    const padding = Math.round(size * 0.1);
    const innerSize = size - padding * 2;

    await sharp(Buffer.from(svgContent))
      .resize(innerSize, innerSize, { fit: "contain", background: { r: 91, g: 141, b: 239 } })
      .extend({
        top: padding,
        bottom: padding,
        left: padding,
        right: padding,
        background: { r: 91, g: 141, b: 239 },
      })
      .png()
      .toFile(outPath);

    console.log(`  ✅ ${outPath} (maskable ${size}x${size})`);
  }

  console.log("\n🎉 PWA 图标生成完成！");
}

main().catch((err) => {
  console.error("❌ 生成失败:", err);
  process.exit(1);
});
