import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 要复制的文件列表
const filesToCopy = [
  { src: "request.global.js", dest: "request.global.js" },
  { src: "request.api.global.js", dest: "request.api.global.js" },
  // HTML/JS 通用初始化工具（封装 waitForRequestInit 等）
  { src: "react_init.js", dest: "react_init.js" },
];

const srcDir = path.join(__dirname, "..", "build", "global");
const destDir = path.join(__dirname, "..", "..", "static", "bundles");

try {
  // 确保目标目录存在
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  let successCount = 0;
  let failCount = 0;

  // 复制入口 JS 文件
  for (const { src, dest } of filesToCopy) {
    const srcPath = path.join(srcDir, src);
    const destPath = path.join(destDir, dest);

    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`✅ 已复制 ${src} -> ${destPath}`);
      successCount++;
    } else {
      console.error(`❌ 构建文件不存在: ${srcPath}`);
      failCount++;
    }
  }

  // 复制 assets 目录（用于入口文件引用的 chunk）
  const assetsSrcDir = path.join(srcDir, "assets");
  const assetsDestDir = path.join(destDir, "assets");
  if (fs.existsSync(assetsSrcDir)) {
    fs.cpSync(assetsSrcDir, assetsDestDir, { recursive: true });
    console.log(`✅ 已复制 assets 目录 -> ${assetsDestDir}`);
  } else {
    console.log("ℹ️ 未找到 assets 目录（可能未生成额外 chunk）");
  }

  if (failCount > 0) {
    console.error(`❌ 复制失败 ${failCount} 个文件`);
    process.exit(1);
  }

  console.log(`✅ 成功复制 ${successCount} 个文件到 static/bundles 目录`);
} catch (error) {
  console.error("❌ 复制文件时出错:", error);
  process.exit(1);
}

