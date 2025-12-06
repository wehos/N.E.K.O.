import { defineConfig } from "vite";
import { resolve } from "path";
import { readFileSync, writeFileSync, existsSync } from "fs";
import type { Plugin } from "vite";

// 读取 package.json 获取版本信息
const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, "package.json"), "utf-8")
);
const reactVersion = packageJson.dependencies.react || "^19.1.1";

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
      // 在文件写入后，再次处理 process.env（处理可能遗漏的情况）
      const outDir = options.dir || "build/react-bundles";
      const jsFile = resolve(outDir, "react.js");
      if (existsSync(jsFile)) {
        let content = readFileSync(jsFile, "utf-8");
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
        
        /**
         * ============================================================================
         * ⚠️ 重要说明：为什么必须使用字符串替换而不是源码层面的修改
         * ============================================================================
         * 
         * 问题背景：
         * - React 19 的 hooks 实现依赖于 ReactSharedInternals.H（hooks dispatcher）
         * - ReactDOM 在初始化时会设置这个 dispatcher
         * - 但在某些场景下（如独立组件加载），React 可能在 ReactDOM 初始化之前被调用
         * - 这会导致 hooks 无法正常工作
         * 
         * 为什么不能源码层面解决：
         * - React 是第三方库，我们无法修改其源码
         * - 即使 fork React，维护成本极高，且无法跟上 React 的更新
         * - React 的内部实现（ReactSharedInternals）是私有 API，不对外暴露
         * 
         * 为什么使用字符串替换而不是 Vite transform hook：
         * - Vite 的 transform hook 在模块级别工作，但 React 的 hooks dispatcher
         *   是在打包后的代码中通过对象属性访问的（react_production.useState = ...）
         * - 这些属性赋值发生在打包后的代码中，无法在源码层面拦截
         * - 必须在打包完成后，对生成的代码进行后处理
         * 
         * 方案的脆弱性：
         * - ⚠️ 此方案依赖 React 打包后的代码格式
         * - ⚠️ 如果 React 内部实现改变（如 hooks 的导出方式），此方案可能失效
         * - ⚠️ 需要定期检查 React 版本更新是否影响此替换逻辑
         * 
         * 维护建议：
         * 1. 每次升级 React 版本时，检查构建后的 react.js 文件格式是否变化
         * 2. 如果替换失败，构建会成功但运行时可能报错，需要测试验证
         * 3. 考虑在 CI/CD 中添加自动化测试，验证 hooks 是否正常工作
         * 
         * 替代方案（未来考虑）：
         * - 等待 React 官方提供更好的 hooks dispatcher 初始化机制
         * - 或者使用 React 的官方 CDN 版本（但失去了本地打包的控制）
         * - 或者等待 React 支持更好的独立组件加载方式
         * 
         * ============================================================================
         */
        
        // 修复：确保所有 hooks 从 __CLIENT_INTERNALS 获取 ReactSharedInternals
        // 这样 ReactDOM 设置的 H 可以被 React 的 hooks 使用
        // 在文件开头添加一个临时的 hooks dispatcher，用于在 ReactDOM 初始化之前
        const tempDispatcherCode = `
// 临时 hooks dispatcher，用于在 ReactDOM 初始化之前
(function() {
  var __tempHooksDispatcher = null;
  window.getHooksDispatcher = function getHooksDispatcher() {
    var internals = react_production.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
    if (internals && internals.H) {
      return internals.H;
    }
    // 如果 ReactDOM 还没有初始化，创建一个临时的 dispatcher
    if (!__tempHooksDispatcher) {
      __tempHooksDispatcher = {
        useState: function(initialState) {
          console.warn('[React] useState called before ReactDOM initialization, using temporary implementation');
          var state = typeof initialState === 'function' ? initialState() : initialState;
          // 创建一个可以工作的 setState，在 ReactDOM 初始化后会自动切换到真正的实现
          return [state, function(newState) {
            console.warn('[React] setState called before ReactDOM initialization, state update will be ignored');
            // 注意：这个 setState 不会真正更新状态，但至少不会崩溃
            // 当 ReactDOM 初始化后，组件会重新渲染，使用真正的 hooks dispatcher
          }];
        },
        useEffect: function() {},
        useCallback: function(fn) { return fn; },
        useMemo: function(fn) { return fn(); },
        useRef: function(initialValue) { return { current: initialValue }; },
        useContext: function() { return null; },
        useReducer: function(reducer, initialState, init) {
          var state = init ? init(initialState) : initialState;
          return [state, function() {}];
        },
        useLayoutEffect: function() {},
        useImperativeHandle: function() {},
        useId: function() { return ''; },
        useSyncExternalStore: function(subscribe, getSnapshot) {
          // 提供 no-op subscribe/unsubscribe 以避免类型错误
          // subscribe 接受一个 callback 并返回一个 unsubscribe 函数
          if (typeof subscribe === 'function') {
            var unsubscribe = subscribe(function() {}); // no-op callback
            // unsubscribe 是一个函数，但我们不需要调用它（这是临时实现）
          }
          // 返回 getSnapshot() 的结果，如果 getSnapshot 是函数
          return typeof getSnapshot === 'function' ? getSnapshot() : null;
        },
        useInsertionEffect: function() { return function() {}; },
        useTransition: function() { return [false, function() {}]; },
        useDeferredValue: function(value) { return value; },
        useActionState: function() { return [null, function() {}]; },
        useOptimistic: function() { return null; },
        use: function() { return null; },
        cache: function(fn) { return fn; },
        useMemoCache: function(size) {
          console.warn('[React] useMemoCache called before ReactDOM initialization, using temporary implementation');
          // 返回一个指定大小的数组，每个元素初始化为 undefined
          // 这是一个安全的 no-op 实现，在 ReactDOM 初始化后会切换到真正的实现
          var cache = [];
          for (var i = 0; i < size; i++) {
            cache[i] = undefined;
          }
          return cache;
        }
      };
    }
    return __tempHooksDispatcher;
  };
})();
`;
        
        // 在 react_production 定义之后插入临时 dispatcher
        // 注意：ES Module 顶层不能有 return 语句，所以使用 IIFE 包装
        // 匹配时包含可能的分号，避免重复添加，并确保在正确的位置插入
        const reactProductionPattern = /(var react_production = \{\};)\s*;?\s*/;
        if (reactProductionPattern.test(content)) {
          content = content.replace(
            reactProductionPattern,
            `$1;\n${tempDispatcherCode}\n`
          );
        } else {
          console.warn('[React Bundle] 未找到 react_production 定义，跳过 hooks dispatcher 注入');
        }
        
        /**
         * 修复所有 hooks，使其使用 getHooksDispatcher()
         * 
         * ⚠️ 安全说明：
         * - hookNames 是固定的字符串数组，不包含用户输入，因此不存在 ReDoS 风险
         * - 但为了代码清晰和防御性编程，我们仍然对 hookName 进行转义
         * - 使用 String.prototype.replace 而不是直接字符串拼接来构建正则表达式
         */
        const hookNames = [
          'useState', 'useEffect', 'useCallback', 'useMemo', 'useRef',
          'useContext', 'useReducer', 'useLayoutEffect', 'useImperativeHandle',
          'useId', 'useSyncExternalStore', 'useInsertionEffect', 'useTransition',
          'useDeferredValue', 'useActionState', 'useOptimistic', 'use', 'cache', 'useMemoCache'
        ] as const;
        
        // 转义函数：将字符串中的特殊正则字符转义
        // 虽然 hookNames 是固定的，但转义可以确保代码更安全
        const escapeRegex = (str: string): string => {
          return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        };
        
        for (const hookName of hookNames) {
          // 转义 hookName 以确保正则表达式安全（防御性编程）
          const escapedHookName = escapeRegex(hookName);
          
          /**
           * 匹配模式：react_production.hookName = function(...) { return ReactSharedInternals.H.hookName(...); }
           * 
           * 说明：
           * - 这个模式匹配 React 打包后的 hooks 定义格式
           * - 单行格式：所有代码在一行内
           * - 多行格式：代码可能跨多行（使用 [\s\S]*? 非贪婪匹配）
           * 
           * ⚠️ 注意：如果 React 的打包格式改变，这个正则可能失效
           */
          
          // 单行格式匹配（更常见）
          const singleLinePattern = new RegExp(
            `react_production\\.${escapedHookName}\\s*=\\s*function\\s*\\([^)]*\\)\\s*\\{[^}]*return\\s+ReactSharedInternals\\.H\\.${escapedHookName}\\([^)]*\\)[^}]*\\}`,
            'g'
          );
          content = content.replace(
            singleLinePattern,
            `react_production.${hookName} = function(...args) { var dispatcher = getHooksDispatcher(); return dispatcher.${hookName}(...args); }`
          );
          
          // 多行格式匹配（处理格式化后的代码）
          const multilinePattern = new RegExp(
            `react_production\\.${escapedHookName}\\s*=\\s*function\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?return\\s+ReactSharedInternals\\.H\\.${escapedHookName}\\([^)]*\\)[\\s\\S]*?\\}`,
            'g'
          );
          content = content.replace(
            multilinePattern,
            `react_production.${hookName} = function(...args) { var dispatcher = getHooksDispatcher(); return dispatcher.${hookName}(...args); }`
          );
        }
        
        /**
         * 处理其他使用 ReactSharedInternals.H 的地方
         * 
         * 这个替换是兜底方案，处理可能遗漏的 hooks 调用
         * 使用 \w+ 匹配任何标识符（hook 名称）
         */
        content = content.replace(
          /ReactSharedInternals\.H\.(\w+)/g,
          'getHooksDispatcher().$1'
        );
        
        /**
         * 修复 __COMPILER_RUNTIME.c 调用，添加安全检查
         * 
         * React 19 的编译器运行时使用 useMemoCache，需要确保它能正常工作
         * 这个替换处理编译后的代码格式（可能跨多行）
         * 
         * ⚠️ 注意：使用 /s 标志允许 . 匹配换行符
         */
        // 修复 __COMPILER_RUNTIME.c 调用，添加安全检查
        // 注意：匹配时不要包含对象定义后的分号，避免添加额外的闭合大括号
        content = content.replace(
          /react_production\.__COMPILER_RUNTIME\s*=\s*\{[^}]*c:\s*function\s*\(size\)\s*\{[^}]*return\s+getHooksDispatcher\(\)\.useMemoCache\(size\);[^}]*\}\s*;?\s*\}/s,
          `react_production.__COMPILER_RUNTIME = {
    __proto__: null,
    c: function(size) {
      var d = getHooksDispatcher();
      return typeof d.useMemoCache === 'function' ? d.useMemoCache(size) : (function() {
        console.warn('[React] useMemoCache not available, returning empty array');
        var cache = [];
        for (var i = 0; i < size; i++) {
          cache[i] = undefined;
        }
        return cache;
      }());
    }
  }`
        );
        
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
      entry: resolve(__dirname, "app/react-bundles/react.ts"),
      name: "React",
      formats: ["es"],
      fileName: () => "react.js",
    },
    rollupOptions: {
      output: {
        format: "es",
        exports: "named",
        banner: `/* React ${reactVersion} - Bundled locally at build time */\n`,
      },
    },
    outDir: "build/react-bundles",
    emptyOutDir: false,
    minify: false,
  },
});

