import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const src = path.join(__dirname, "..", "build", "components", "Modal.js");
const dest = path.join(__dirname, "..", "..", "static", "bundles", "Modal.js");

// 复制 assets 目录（包含 jsx-runtime）
const srcAssetsDir = path.join(__dirname, "..", "build", "components", "assets");
const destAssetsDir = path.join(__dirname, "..", "..", "static", "bundles", "assets");

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const files = fs.readdirSync(src);
    for (const file of files) {
      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

try {
  if (fs.existsSync(src)) {
    // 确保目标目录存在
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    // 复制 Modal.js
    fs.copyFileSync(src, dest);
    console.log("✅ 已复制 Modal 到 static/bundles 目录:", dest);
    
    // 复制 assets 目录（如果存在）
    if (fs.existsSync(srcAssetsDir)) {
      copyRecursive(srcAssetsDir, destAssetsDir);
      console.log("✅ 已复制 assets 目录到 static/bundles/assets");
    } else {
      console.warn("⚠️  assets 目录不存在，跳过复制");
    }
  } else {
    console.error("❌ 构建文件不存在:", src);
    process.exit(1);
  }
} catch (error) {
  console.error("❌ 复制文件时出错:", error);
  process.exit(1);
}

