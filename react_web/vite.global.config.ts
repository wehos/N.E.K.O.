import { defineConfig } from "vite";
import { resolve, dirname, join } from "path";
import { readFileSync, writeFileSync, existsSync, unlinkSync, readdirSync, rmdirSync } from "fs";
import tsconfigPaths from "vite-tsconfig-paths";
import type { Plugin } from "vite";

// 插件：处理 process.env 和外部依赖
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

// 插件：合并所有 chunk 到入口文件，确保每个入口文件都是独立的单文件
function inlineAllChunks(): Plugin {
  return {
    name: "inline-all-chunks",
    writeBundle(options, bundle) {
      const outDir = options.dir || 'build/global';
      
      // 查找所有入口文件
      const entryFiles: string[] = [];
      for (const fileName in bundle) {
        const chunk = bundle[fileName];
        if (chunk.type === "chunk" && chunk.isEntry) {
          entryFiles.push(fileName);
        }
      }
      
      // 处理每个入口文件
      for (const entryFile of entryFiles) {
        const entryPath = join(outDir, entryFile);
        if (!existsSync(entryPath)) {
          console.warn(`[inline-all-chunks] 入口文件不存在: ${entryPath}`);
          continue;
        }
        
        console.log(`[inline-all-chunks] 处理入口文件: ${entryFile}`);
        let entryContent = readFileSync(entryPath, 'utf-8');
        let modified = false;
        
        // 递归查找并合并所有 chunk
        const processedChunks = new Set<string>();
        const mergeChunks = (content: string, baseDir: string): string => {
          // 更宽松的正则，匹配各种格式的 import 语句
          // 包括：import {...} from "./path" 和 import {...}from"./path"（无空格）
          const importRegex = /import\s+[^'"]+\s+from\s*['"](\.\/[^'"]+)['"];?\s*/g;
          let result = content;
          const imports: Array<{ match: string; path: string }> = [];
          
          // 收集所有 import（使用 matchAll 避免 exec 的全局状态问题）
          const matches = content.matchAll(importRegex);
          for (const match of matches) {
            imports.push({ match: match[0], path: match[1] });
          }
          
          // 处理每个 import
          for (const { match: importMatch, path: importPath } of imports) {
            if (processedChunks.has(importPath)) {
              // 已处理过，移除 import
              result = result.replace(importMatch, '');
              modified = true;
              continue;
            }
            
            // 解析 chunk 文件路径
            const chunkRelativePath = importPath.replace(/^\.\//, '');
            const chunkPath = resolve(baseDir, chunkRelativePath);
            
            if (existsSync(chunkPath)) {
              console.log(`[inline-all-chunks] 找到 chunk: ${chunkPath}`);
              processedChunks.add(importPath);
              let chunkContent = readFileSync(chunkPath, 'utf-8');
              
              // 递归处理 chunk 中的 import
              chunkContent = mergeChunks(chunkContent, dirname(chunkPath));
              
              // 移除 chunk 中的 import/export 语句
              chunkContent = chunkContent.replace(/import\s+[^'"]+\s+from\s*['"][^'"]+['"];?\s*/g, '');
              chunkContent = chunkContent.replace(/export\s+(\{[^}]+\})\s+from\s*['"][^'"]+['"];?\s*/g, '');
              chunkContent = chunkContent.replace(/export\s+default\s+/g, '');
              chunkContent = chunkContent.replace(/export\s+const\s+/g, 'const ');
              chunkContent = chunkContent.replace(/export\s+function\s+/g, 'function ');
              chunkContent = chunkContent.replace(/export\s+class\s+/g, 'class ');
              chunkContent = chunkContent.replace(/export\s+type\s+.*?;?\s*/g, '');
              
              // 替换 import 语句为 chunk 内容
              result = result.replace(importMatch, '\n' + chunkContent + '\n');
              modified = true;
              
              // 删除 chunk 文件
              try {
                unlinkSync(chunkPath);
                // 如果 assets 目录为空，也删除它
                const assetsDir = dirname(chunkPath);
                if (existsSync(assetsDir) && readdirSync(assetsDir).length === 0) {
                  rmdirSync(assetsDir);
                }
              } catch (e) {
                // 忽略删除错误
              }
            } else {
              // 找不到 chunk，移除 import
              result = result.replace(importMatch, '');
              modified = true;
            }
          }
          
          return result;
        };
        
        // 合并所有 chunk
        entryContent = mergeChunks(entryContent, dirname(entryPath));
        
        // 如果修改了，写回文件
        if (modified) {
          writeFileSync(entryPath, entryContent, 'utf-8');
          console.log(`[inline-all-chunks] ✅ 已合并 chunk 到 ${entryFile}`);
        } else {
          console.log(`[inline-all-chunks] ⚠️  ${entryFile} 未找到需要合并的 chunk`);
        }
      }
    },
  };
}

/**
 * 构建全局库的配置
 * 当前构建：
 * - request.global.ts：必备 Request 全局库（ES Module）
 * - request.api.global.ts：首页 API 封装模块（ES Module）
 *
 * react_init.ts 单独由 vite.react_init.config.ts 构建为 IIFE。
 */
export default defineConfig({
  plugins: [
    tsconfigPaths(), // 解析 TypeScript 路径别名（如 @project_neko/request）
    rewriteExternalImports(),
    inlineAllChunks(), // 合并所有 chunk 到入口文件
  ],
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  build: {
    // 不使用 lib 模式，直接使用 rollup 多入口
    rollupOptions: {
      // 多入口配置（global 代码集中放在 app/api/global 目录）
      input: {
        "request.global": resolve(__dirname, "app/api/global/request.global.ts"),
        "request.api.global": resolve(__dirname, "app/api/global/request.api.global.ts"),
      },
      output: {
        // 使用 ES Module 形式输出
        format: "es",
        entryFileNames: "[name].js",
        // 对于多入口构建，不能使用 inlineDynamicImports
        // 使用插件在构建后合并所有 chunk 到入口文件
      },
      // 不将 axios 等设为 external，打包进去
      external: [],
    },
    // 压缩代码
    minify: "esbuild", // 使用 esbuild，更快且配置更简单
    outDir: "build/global",
    // 不清空目录，避免覆盖由 vite.react_init.config.ts 生成的 react_init.js
    emptyOutDir: false,
  },
});

