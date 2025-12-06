import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 清理 static/bundles 目录
 * 用于全量构建前清理，避免旧文件残留
 */
const bundlesDir = path.join(__dirname, "..", "..", "static", "bundles");

try {
  if (fs.existsSync(bundlesDir)) {
    // 删除整个目录
    fs.rmSync(bundlesDir, { recursive: true, force: true });
    console.log(`🧹 已清理 static/bundles 目录: ${bundlesDir}`);
  } else {
    console.log(`ℹ️  static/bundles 目录不存在，无需清理`);
  }
} catch (error) {
  console.error("❌ 清理目录时出错:", error);
  process.exit(1);
}

