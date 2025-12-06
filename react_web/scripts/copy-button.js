import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const src = path.join(__dirname, "..", "build", "components", "Button.js");
const dest = path.join(__dirname, "..", "..", "static", "bundles", "Button.js");

try {
  if (fs.existsSync(src)) {
    // 确保目标目录存在
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    fs.copyFileSync(src, dest);
    console.log("✅ 已复制 Button.js 到 static/bundles 目录:", dest);
  } else {
    console.error("❌ 构建文件不存在:", src);
    process.exit(1);
  }
} catch (error) {
  console.error("❌ 复制文件时出错:", error);
  process.exit(1);
}

