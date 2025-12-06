import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve, join } from "path";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import type { Plugin } from "vite";

// 组件配置
const components = [
  {
    name: "StatusToast",
    entry: resolve(__dirname, "app/components/StatusToast.tsx"),
    output: "StatusToast.js",
    styleId: "status-toast-styles",
    cssFiles: ["react_web.css", "StatusToast.css", "style.css"],
    needsTailwind: false,
  },
  {
    name: "Modal",
    entry: resolve(__dirname, "app/components/Modal/index.tsx"),
    output: "Modal.js",
    styleId: "modal-styles",
    cssFiles: ["react_web.css", "Modal.css", "style.css"],
    needsTailwind: false,
  },
  {
    name: "Button",
    entry: resolve(__dirname, "app/components/Button.tsx"),
    output: "Button.js",
    styleId: "button-styles",
    cssFiles: ["react_web.css", "Button.css", "style.css"],
    needsTailwind: false,
  },
];

// 辅助函数：去除注释和字符串字面量，用于代码分析
function stripCommentsAndStrings(code: string): string {
  let result = "";
  let i = 0;
  const len = code.length;
  
  while (i < len) {
    // 单行注释 //
    if (code[i] === "/" && code[i + 1] === "/") {
      while (i < len && code[i] !== "\n" && code[i] !== "\r") {
        i++;
      }
      continue;
    }
    
    // 多行注释 /* */
    if (code[i] === "/" && code[i + 1] === "*") {
      i += 2;
      while (i < len - 1) {
        if (code[i] === "*" && code[i + 1] === "/") {
          i += 2;
          break;
        }
        i++;
      }
      continue;
    }
    
    // 单引号字符串
    if (code[i] === "'") {
      i++;
      while (i < len) {
        if (code[i] === "\\") {
          i += 2; // 跳过转义字符
          continue;
        }
        if (code[i] === "'") {
          i++;
          break;
        }
        i++;
      }
      result += " "; // 用空格替换字符串内容
      continue;
    }
    
    // 双引号字符串
    if (code[i] === '"') {
      i++;
      while (i < len) {
        if (code[i] === "\\") {
          i += 2; // 跳过转义字符
          continue;
        }
        if (code[i] === '"') {
          i++;
          break;
        }
        i++;
      }
      result += " "; // 用空格替换字符串内容
      continue;
    }
    
    // 模板字符串 `...`
    if (code[i] === "`") {
      i++;
      while (i < len) {
        if (code[i] === "\\") {
          i += 2; // 跳过转义字符
          continue;
        }
        if (code[i] === "`") {
          i++;
          break;
        }
        i++;
      }
      result += " "; // 用空格替换字符串内容
      continue;
    }
    
    result += code[i];
    i++;
  }
  
  return result;
}

// 辅助函数：检测代码中是否存在导出或组件定义
function hasExportOrComponent(code: string, componentName: string): boolean {
  // 先去除注释和字符串，避免误匹配
  const cleaned = stripCommentsAndStrings(code);
  
  // 检测导出模式
  const exportPatterns = [
    // export default
    /\bexport\s+default\b/,
    // export const/let/var/function/class
    /\bexport\s+(?:const|let|var|function|class)\s+/,
    // export { ... } 或 export * from
    /\bexport\s*\{/,
    /\bexport\s+\*/,
  ];
  
  // 检测组件定义模式
  const componentPatterns = [
    // export default function ComponentName
    new RegExp(`\\bexport\\s+default\\s+function\\s+${componentName}\\b`),
    // export function ComponentName
    new RegExp(`\\bexport\\s+function\\s+${componentName}\\b`),
    // export const ComponentName = ...
    new RegExp(`\\bexport\\s+const\\s+${componentName}\\s*=`),
    // export class ComponentName
    new RegExp(`\\bexport\\s+class\\s+${componentName}\\b`),
    // function ComponentName(...)
    new RegExp(`\\bfunction\\s+${componentName}\\s*\\(`),
    // const ComponentName = (...) => ...
    new RegExp(`\\bconst\\s+${componentName}\\s*=\\s*\\([^)]*\\)\\s*=>`),
    // const ComponentName = function(...)
    new RegExp(`\\bconst\\s+${componentName}\\s*=\\s*function\\s*\\(`),
    // class ComponentName
    new RegExp(`\\bclass\\s+${componentName}\\b`),
    // const ComponentName = React.forwardRef(...) 或类似
    new RegExp(`\\bconst\\s+${componentName}\\s*=\\s*React\\.`),
  ];
  
  // 检查是否有任何导出
  const hasExport = exportPatterns.some(pattern => pattern.test(cleaned));
  
  // 检查是否有组件定义
  const hasComponent = componentPatterns.some(pattern => pattern.test(cleaned));
  
  return hasExport || hasComponent;
}

// 辅助函数：重写 React 导入为本地路径
// 处理所有格式：from/import/dynamic import，包括压缩后的格式（无空格）
function rewriteReactImports(code: string): string {
  // 定义所有替换规则：按优先级排序，更具体的模式在前
  const replacements: Array<{ pattern: RegExp; replacement: string }> = [
    // 1. 处理 react-dom/client（最具体的路径，优先处理）
    { pattern: /from\s*["']react-dom\/client["']/g, replacement: 'from "/static/bundles/react-dom-client.js"' },
    { pattern: /import\s*["']react-dom\/client["']/g, replacement: 'import "/static/bundles/react-dom-client.js"' },
    { pattern: /import\(["']react-dom\/client["']\)/g, replacement: 'import("/static/bundles/react-dom-client.js")' },
    
    // 2. 处理 react-dom
    { pattern: /from\s*["']react-dom["']/g, replacement: 'from "/static/bundles/react-dom-client.js"' },
    { pattern: /import\s*["']react-dom["']/g, replacement: 'import "/static/bundles/react-dom-client.js"' },
    { pattern: /import\(["']react-dom["']\)/g, replacement: 'import("/static/bundles/react-dom-client.js")' },
    
    // 3. 处理 react
    { pattern: /from\s*["']react["']/g, replacement: 'from "/static/bundles/react.js"' },
    { pattern: /import\s*["']react["']/g, replacement: 'import "/static/bundles/react.js"' },
    { pattern: /import\(["']react["']\)/g, replacement: 'import("/static/bundles/react.js")' },
  ];
  
  // 应用所有替换规则
  let result = code;
  for (const { pattern, replacement } of replacements) {
    result = result.replace(pattern, replacement);
  }
  
  return result;
}

// 插件：重写外部依赖的导入路径为 CDN URL，并处理 process.env
function rewriteExternalImports(): Plugin {
  return {
    name: "rewrite-external-imports",
    generateBundle(options, bundle) {
      // 处理 JS 代码
      for (const fileName in bundle) {
        const chunk = bundle[fileName];
        if (chunk.type === "chunk" && chunk.code) {
          // 检查代码中是否包含组件代码（调试用）
          const component = components.find(c => chunk.name === c.name || fileName.includes(c.name));
          if (component) {
            console.log(`📝 [${component.name}] 处理 chunk: ${fileName}, 代码长度: ${chunk.code.length}`);
            // 确保导出被保留 - 使用健壮的检测方法
            if (!hasExportOrComponent(chunk.code, component.name)) {
              console.warn(`⚠️  [${component.name}] 警告: 代码中可能缺少导出或组件定义`);
            }
          }
          
          // 将 react 和 react-dom 的导入重写为本地路径
          chunk.code = rewriteReactImports(chunk.code);
          
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
    writeBundle(options, bundle) {
      // 在文件写入后，为每个组件处理 CSS 注入
      const outDir = options.dir || "build/components";
      
      // 从 bundle 中查找 CSS 文件
      const cssFilesInBundle: string[] = [];
      for (const fileName in bundle) {
        const chunk = bundle[fileName];
        if (chunk.type === "asset" && fileName.endsWith(".css")) {
          cssFilesInBundle.push(fileName);
        }
      }
      
      // 收集所有 CSS 内容
      let allCssContent = "";
      for (const cssFile of cssFilesInBundle) {
        const cssPath = join(outDir, cssFile);
        if (existsSync(cssPath)) {
          const content = readFileSync(cssPath, "utf-8");
          allCssContent += content + "\n";
          console.log(`📦 读取 CSS 文件: ${cssFile} (${content.length} 字符)`);
          // 删除 CSS 文件
          unlinkSync(cssPath);
        }
      }
      
      // 为每个组件注入 CSS 并处理 React 导入
      for (const component of components) {
        const jsPath = join(outDir, component.output);
        if (existsSync(jsPath)) {
          let jsContent = readFileSync(jsPath, "utf-8");
          
          // 处理 React 导入重写（处理各种格式）- 改为本地路径
          jsContent = rewriteReactImports(jsContent);
          
          // 注入 CSS（如果有）
          if (allCssContent) {
            const injectCSS = `// 注入 ${component.name} CSS 样式
(function() {
  if (document.getElementById('${component.styleId}')) return;
  const style = document.createElement('style');
  style.id = '${component.styleId}';
  style.textContent = ${JSON.stringify(allCssContent)};
  document.head.appendChild(style);
})();
`;
            jsContent = injectCSS + jsContent;
            console.log(`✅ [${component.name}] 已注入 CSS 到 ${component.output}，CSS 长度: ${allCssContent.length} 字符`);
          }
          
          writeFileSync(jsPath, jsContent, "utf-8");
        } else {
          console.warn(`⚠️  [${component.name}] 未找到 JS 文件: ${component.output}`);
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Tailwind 插件会处理所有文件，但只有使用 Tailwind 类的文件会生成 CSS
    rewriteExternalImports(),
  ],
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  build: {
    // 使用多入口构建
    rollupOptions: {
      input: components.reduce((acc, component) => {
        acc[component.name] = component.entry;
        return acc;
      }, {} as Record<string, string>),
      external: ["react", "react-dom", "react-dom/client"],
      // 保留入口点的导出签名，防止 tree-shaking 移除导出
      preserveEntrySignatures: "exports-only",
      output: {
        format: "es",
        exports: "named",
        entryFileNames: (chunkInfo) => {
          // 根据入口名称返回对应的输出文件名
          const component = components.find(c => c.name === chunkInfo.name);
          return component ? component.output : "[name].js";
        },
        // 确保所有导出都被保留
        preserveModules: false,
      },
    },
    cssCodeSplit: false,
    outDir: "build/components",
    emptyOutDir: false, // 不清空目录，因为可能还有其他组件
  },
});

