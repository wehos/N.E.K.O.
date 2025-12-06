import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, "..", "build", "react-bundles");
const destDir = path.join(__dirname, "..", "..", "static", "bundles");

try {
  // 确保目标目录存在
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // 复制所有 JS 文件（包括主文件和 chunk 文件）
  const files = fs.readdirSync(srcDir);
  const jsFiles = files.filter(file => file.endsWith('.js'));

  for (const file of jsFiles) {
    const src = path.join(srcDir, file);
    const dest = path.join(destDir, file);

    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`✅ 已复制 ${file} 到 static/bundles 目录: ${dest}`);
    }
  }

  // 验证主要文件是否存在
  const requiredFiles = ["react.js", "react-dom-client.js"];
  for (const file of requiredFiles) {
    const dest = path.join(destDir, file);
    if (!fs.existsSync(dest)) {
      console.error(`❌ 必需文件不存在: ${file}`);
      process.exit(1);
    }
  }
} catch (error) {
  console.error("❌ 复制文件时出错:", error);
  process.exit(1);
}

