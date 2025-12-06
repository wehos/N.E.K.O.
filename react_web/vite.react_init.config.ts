import { defineConfig } from "vite";
import { resolve } from "path";
import tsconfigPaths from "vite-tsconfig-paths";
import type { Plugin } from "vite";

// 插件：处理 process.env 和外部依赖（与 vite.global.config.ts 保持一致）
function rewriteExternalImports(): Plugin {
  return {
    name: "rewrite-external-imports",
    generateBundle(options, bundle) {
      // 处理 JS 代码
      for (const fileName in bundle) {
        const chunk = bundle[fileName];
        if (chunk.type === "chunk" && chunk.code) {
          // 处理 process.env.NODE_ENV
          chunk.code = chunk.code.replace(
            /process\.env\.NODE_ENV/g,
            '"production"'
          );
          // 处理 process.env 的其他引用
          chunk.code = chunk.code.replace(
            /process\.env(?!\.)/g,
            '({ NODE_ENV: "production" })'
          );
        }
      }
    },
  };
}

/**
 * 专门用于构建 react_init.js 的配置
 * - 单入口
 * - 以 IIFE 形式输出，供 HTML 以普通 <script> 同步加载
 */
export default defineConfig({
  plugins: [
    tsconfigPaths(),
    rewriteExternalImports(),
  ],
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  build: {
    lib: {
      entry: resolve(__dirname, "app/api/global/react_init.ts"),
      name: "ReactInit",
      formats: ["iife"],
      fileName: () => "react_init.js",
    },
    rollupOptions: {
      output: {
        format: "iife",
      },
    },
    minify: "esbuild",
    outDir: "build/global",
    emptyOutDir: false, // 不清空目录，保留 request.global.js
  },
});


