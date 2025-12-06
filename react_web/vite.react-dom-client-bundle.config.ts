import { defineConfig } from "vite";
import { resolve } from "path";
import { readFileSync, writeFileSync, existsSync } from "fs";
import type { Plugin } from "vite";

// 读取 package.json 获取版本信息
const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, "package.json"), "utf-8")
);
const reactDomVersion = packageJson.dependencies["react-dom"] || "^19.1.1";

// 插件：处理 process.env 引用
function replaceProcessEnv(): Plugin {
  return {
    name: "replace-process-env",
    generateBundle(options, bundle) {
      for (const fileName in bundle) {
        const chunk = bundle[fileName];
        if (chunk.type === "chunk" && chunk.code) {
          // 替换 process.env.NODE_ENV
          chunk.code = chunk.code.replace(
            /process\.env\.NODE_ENV/g,
            '"production"'
          );
          // 替换 process.env 的其他引用
          chunk.code = chunk.code.replace(
            /process\.env(?!\.)/g,
            '({ NODE_ENV: "production" })'
          );
        }
      }
    },
    writeBundle(options) {
      // 在文件写入后，再次处理 process.env 和 React 导入
      const outDir = options.dir || "build/react-bundles";
      const jsFile = resolve(outDir, "react-dom-client.js");
      if (existsSync(jsFile)) {
        let content = readFileSync(jsFile, "utf-8");
        // 替换 React 导入为本地路径
        content = content.replace(/from\s+["']react["']/g, 'from "/static/bundles/react.js"');
        content = content.replace(/import\s+([^"']+)\s+from\s+["']react["']/g, 'import $1 from "/static/bundles/react.js"');
        // 替换 process.env.NODE_ENV
        content = content.replace(/process\.env\.NODE_ENV/g, '"production"');
        // 替换 process.env 的其他引用
        content = content.replace(/process\.env(?!\.)/g, '({ NODE_ENV: "production" })');
        // 替换 process 相关的条件检查（在浏览器中不需要）
        // 先替换 process.emit，匹配整个函数调用（包括参数和闭括号）
        content = content.replace(/process\.emit\([^)]*\)/g, 'void 0 /* process.emit removed for browser */');
        // 替换 typeof process 检查（确保不会匹配到 process.emit）
        content = content.replace(/"object"\s*===\s*typeof\s+process/g, '"object" === typeof undefined /* process removed for browser */');
        content = content.replace(/"function"\s*===\s*typeof\s+process\.emit/g, '"function" === typeof undefined /* process.emit removed for browser */');
        writeFileSync(jsFile, content, "utf-8");
      }
    },
  };
}

export default defineConfig({
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  plugins: [replaceProcessEnv()],
  build: {
    lib: {
      entry: resolve(__dirname, "app/react-bundles/react-dom-client.ts"),
      name: "ReactDOMClient",
      formats: ["es"],
      fileName: () => "react-dom-client.js",
    },
    rollupOptions: {
      // 将 React 标记为外部依赖，这样 ReactDOM 会从外部获取 React
      external: ["react"],
      output: {
        format: "es",
        exports: "named",
        banner: `/* ReactDOM Client ${reactDomVersion} - Bundled locally at build time */\n`,
        // 注意：globals 选项只对 UMD/IIFE 格式有效，对 ES 模块无效
        // React 导入路径的重写由 writeBundle 钩子中的字符串替换处理
      },
    },
    outDir: "build/react-bundles",
    emptyOutDir: false,
    minify: false,
  },
});

