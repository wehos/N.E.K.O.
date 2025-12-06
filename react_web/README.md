## N.E.K.O React Web 前端

这是 N.E.K.O 的 **React Web 前端**，采用 **混合架构**：

### 🏗️ 双轨架构

1. **React Router v7 SPA 应用**（主轨道）
   - **纯客户端渲染（SPA 模式）** - 所有渲染在浏览器端完成
   - **主界面 UI（Live2D + Chat 容器）** - `app/routes/main.tsx`
   - 与后端 `/api` 的交互与关机 Beacon（`/api/beacon/shutdown`）
   - 与根项目 `static/` 目录中的 Live2D / JS 资源的集成

2. **独立组件构建系统**（渐进式迁移轨道）
   - 将 React 组件打包为 **ES Module**，供传统 HTML/JS 页面使用
   - 支持逐个组件替换旧代码，实现渐进式迁移

### 🎯 设计目标

- ✅ 支持全新 React Router SPA 应用开发
- ✅ 纯客户端渲染，无需 SSR 服务器
- ✅ 支持将现有 `static/app.js` 逐步迁移到 React
- ✅ 新旧代码可以共存运行
- ✅ 保持向后兼容，不影响现有功能
- ✅ 可部署到任何静态文件服务器

---

## 🚀 快速开始（开发者视角）

### 安装依赖

```bash
cd react_web
npm install
```

### 启动开发服务

```bash
cd react_web
npm run dev
```

默认打开 `http://localhost:5173`，需要后端（`main_server.py`）在根项目中已启动。

### 常用构建命令

```bash
cd react_web
npm run build              # 构建 React Router SPA (build/client)
npm run build:react-bundles # 构建 React/ReactDOM bundles (首次或更新时)
npm run build:global       # 构建全局库 (request + react_init)
npm run build:component   # 构建独立组件 (StatusToast)
npm run build:all         # 全量构建 (react-bundles + global + component)
```

更多细节见 **`docs/BUILD_GUIDE.md`**。

---

## 📁 目录结构

```txt
react_web/
├── app/                      # React Router 应用源码
│   ├── api/                  # API 相关代码
│   │   ├── config.ts         # 配置管理（URL 构建等）
│   │   ├── request.ts        # Request 客户端（React 专用）
│   │   ├── request.api.ts    # 首页 API 封装
│   │   └── global/           # 全局库源码（用于 HTML/JS）
│   │       ├── react_init.ts           # 初始化工具
│   │       ├── request.global.ts      # Request 全局库
│   │       └── request.api.global.ts  # 首页 API 全局库
│   ├── components/           # 可复用的 React 组件
│   │   ├── ExampleButton.tsx # 示例：可独立打包的组件（示例，已废弃）
│   │   ├── StatusToast.tsx   # 状态提示组件（已完成 ✅）
│   │   ├── Modal/            # 对话框组件（已完成 ✅）
│   │   │   ├── BaseModal.tsx      # 基础容器组件
│   │   │   ├── AlertDialog.tsx    # 警告对话框
│   │   │   ├── ConfirmDialog.tsx  # 确认对话框
│   │   │   ├── PromptDialog.tsx   # 输入对话框
│   │   │   ├── Modal.css          # 样式文件
│   │   │   └── index.tsx          # 主入口（全局 API）
│   │   └── ...               # 其他组件
│   ├── routes/
│   │   └── main.tsx          # Lanlan Terminal 主页面
│   ├── utils/                # 工具函数（目前为空）
│   ├── root.tsx              # 应用根布局（注入全局脚本）
│   └── routes.ts             # 路由配置
├── packages/                 # 内部包
│   └── effects/
│       └── request/          # 统一 Request 库（@project_neko/request）
├── scripts/
│   ├── copy-component.js    # 复制组件到 static/ 目录
│   ├── copy-global.js        # 复制全局库到 static/ 目录
│   └── clean-bundles.js      # 清理构建产物
├── public/                   # 静态资源
├── build/                    # 构建输出
│   ├── client/               # React Router SPA 静态资源（HTML/JS/CSS）
│   ├── global/               # 全局库构建输出（临时）
│   ├── components/           # 独立组件构建（临时）
│   └── react-bundles/        # React/ReactDOM bundles（临时）
├── docs/                     # 文档（构建、使用、重构计划等）
├── vite.config.ts            # React Router 应用构建配置
├── vite.components.config.ts  # 独立组件构建配置（多组件）
├── vite.global.config.ts     # 全局库构建配置（request.global.js 等）
├── vite.react_init.config.ts # react_init.js 构建配置
├── react-router.config.ts    # React Router 配置
├── global.d.ts               # 全局类型声明
├── tsconfig.json
├── package.json
└── README.md
```

### 目录说明

- **`app/api/`** - API 相关代码
  - `config.ts` - 配置管理（URL 构建等）
  - `request.ts` - Request 客户端（React 专用）
  - `request.api.ts` - 首页 API 封装
  - `global/` - 全局库源码（用于 HTML/JS 环境）
- **`app/components/`** - 既可以用于 React Router 应用，也可以独立打包
- **`packages/effects/request/`** - 统一 Request 库（`@project_neko/request`）
- **`build/global/`** - 临时目录，全局库构建的中转站
- **`build/components/`** - 临时目录，独立组件构建的中转站
- **`build/react-bundles/`** - 临时目录，React/ReactDOM bundles 构建的中转站
- **`../static/bundles/`** - 最终输出目录，供传统 HTML 页面使用

---

## 与主项目 N.E.K.O 的集成关系

- **此目录位置**：`N.E.K.O/react_web`
- **静态资源来源**：依赖根项目的 `static/` 目录（`N.E.K.O/static`）
- **脚本依赖**：`static/bundles/request.global.js`, `static/bundles/request.api.global.js`, `static/bundles/react_init.js`, `static/common_ui.js`, `static/app.js`, `static/libs/*.js`, `static/live2d.js` 等
- **API 地址**：通过环境变量 `VITE_API_BASE_URL` 统一配置，默认 `http://localhost:48911`
- **静态资源服务器地址**：通过 `VITE_STATIC_SERVER_URL` 配置，默认 `http://localhost:48911`
- **构建产物输出**：所有构建产物输出到 `N.E.K.O/static/bundles/` 目录

---

## 📚 文档索引（更多细节）

- **构建指南**：`docs/BUILD_GUIDE.md`  
  - 说明 `build:global` / `build:component` / `build:all` / `clean:bundles` 等命令和构建产物路径。
- **统一 Request 库使用指南**：`docs/USAGE_GUIDE.md`  
  - 详细说明 `request.global.js` / `react_init.js` 在 HTML/JS 和 React 中的用法。
- **React 重构计划（渐进式迁移方案）**：`docs/REACT_REFACTOR_PLAN.md`  
  - 描述从 `static/app.js` 迁移到 React 的阶段性计划与风险评估。
- **Live2D 性能与动画重置分析（技术笔记）**：  
  - `docs/L2D_OPTIMIZE.md`：Live2D Canvas 尺寸与渲染性能优化思路。  
  - `docs/LIVE2D_ANIMATION_RESET_ANALYSIS.md`：Live2D 动画结束后的参数重置机制分析与改进建议。

---

## 统一的 Request 模块

> 详细用法、API 说明与迁移示例见 **`docs/USAGE_GUIDE.md`**。

### 两套前端架构

**1. React Web (`react_web/`)**
- ✅ 使用统一的 `@project_neko/request` 模块（位于 `packages/effects/request/`）
- 在 `app/api/request.ts` 中创建请求客户端实例
- React 组件中直接使用 `import { request } from '~/api/request'`
- 配置工具函数：`import { buildApiUrl, buildStaticUrl, buildWebSocketUrl } from '~/api/config'`

**2. 静态模板 (`templates/index.html`)**
- ✅ 使用 `request.global.js`（打包了 axios 和 axios-auth-refresh）
- ✅ 使用 `request.api.global.js`（首页 API 封装，暴露 `window.RequestAPI`）
- ✅ 使用 `react_init.js`（初始化工具，暴露 `window.ReactInit`）
- 自动初始化 `window.request`、`window.RequestAPI` 等全局对象
- 旧版 JS 代码应使用 `window.request` 或 `window.RequestAPI` 等工具函数

### Request 模块特性

- ✅ **Axios 基础** - 基于 Axios，提供强大的 HTTP 客户端能力
- ✅ **统一请求实例** - 一次配置，全项目使用
- ✅ **自动 Token 刷新** - 401 时自动刷新 access token，无需手动处理
- ✅ **请求队列** - 防止并发刷新 token，确保请求顺序执行
- ✅ **工具函数** - 提供 `buildApiUrl`、`buildStaticUrl`、`buildWebSocketUrl` 等

### 使用方式

**在 React 组件中：**
```typescript
import { request } from '~/api/request';

const data = await request.get('/api/users');
```

**在静态 HTML 或旧版 JS 中：**
```javascript
// 使用 request 实例
const data = await window.request.get('/api/users');

// 使用工具函数构建 URL
const apiUrl = window.buildApiUrl('/api/users');
const wsUrl = window.buildWebSocketUrl('/ws/chat');
```

### 构建全局库

构建全局库（用于 HTML/JS 环境）：

```bash
npm run build:global   # 构建 request.global.js + request.api.global.js + react_init.js
# 或
npm run build:all      # 全量构建（global + component）
```

构建产物：
- `static/bundles/request.global.js` - Request 库（暴露 `window.request` 等）
- `static/bundles/request.api.global.js` - 首页 API 封装（暴露 `window.RequestAPI`）
- `static/bundles/react_init.js` - 初始化工具（暴露 `window.ReactInit`）

这些文件会从 `app/api/global/` 目录的源码构建，并自动复制到 `static/bundles/` 目录。

---

## 环境变量（概要）

- 环境变量的完整说明（包括 `.env` 示例与静态资源配置），请参见 **`docs/BUILD_GUIDE.md`**。
- 这里只保留两个关键变量名称：
  - **`VITE_API_BASE_URL`**：后端 API 根地址
  - **`VITE_STATIC_SERVER_URL`**：静态资源服务器地址（用于 `/static/...` 资源）

---

## 独立组件构建（渐进式迁移）

虽然主界面已经由 `main.tsx` + 传统 JS 管理，但仍支持将 React 组件单独打包成 ES Module，逐步替换 `static/app.js` 中的旧逻辑。

### 🎯 适用场景

- 希望逐步将 `static/app.js` 中的功能迁移到 React
- 需要新旧代码共存运行
- 想要降低迁移风险，一个组件一个组件替换
- 需要在传统 HTML 页面中使用现代 React 组件

### 📦 组件开发快速指南

#### 1. 创建新组件

```bash
# 方式 1: 简单组件（直接在 components/ 下）
cd app/components
touch MyComponent.tsx MyComponent.css

# 方式 2: 复杂组件（独立目录）
mkdir -p app/components/MyComponent
cd app/components/MyComponent
touch MyComponent.tsx MyComponent.css index.ts
```

#### 2. 组件结构

**简单组件** (用于 React Router 应用或简单的独立构建):
```txt
app/components/
└── MyComponent.tsx      # 组件实现（含样式导入）
```

**完整组件** (用于复杂的独立构建，需要全局 API):
```txt
app/components/MyComponent/
├── MyComponent.tsx      # 组件实现
├── MyComponent.css     # 组件样式（含 @import "tailwindcss"）
└── index.ts            # 挂载逻辑和全局 API
```

> **注意**：如果组件需要独立打包，必须在 CSS 文件中显式导入 Tailwind：
> ```css
> @import "tailwindcss";
> ```

#### 3. 简单组件模板

适合大多数场景的简洁模板：

```typescript
// app/components/MyComponent.tsx
import React from 'react'

interface MyComponentProps {
  title?: string
  onAction?: () => void
}

export function MyComponent({ title = 'Default', onAction }: MyComponentProps) {
  return (
    <div className="my-component p-4 bg-white rounded shadow">
      <h3 className="text-lg font-bold">{title}</h3>
      <button 
        onClick={onAction}
        className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Click Me
      </button>
    </div>
  )
}
```

### 构建命令

```bash
cd react_web
# 构建 React/ReactDOM bundles（首次构建或更新 React 版本时）
npm run build:react-bundles

# 构建独立组件
npm run build:component
```

流程：

1. **React Bundles 构建**（`build:react-bundles`）：
   - 构建 `react.js` 和 `react-dom-client.js` 到 `static/bundles/`
   - 这些 bundles 供独立组件使用，避免重复打包 React

2. **组件构建**（`build:component`）：
   - 使用 `vite.components.config.ts` 将组件打包为 ES Module（`build/components/*.js`）
   - 在构建过程中：
     - 将 React / ReactDOM 标记为外部依赖，改为从本地 `/static/bundles/` 加载
     - 自动处理 `process.env.NODE_ENV`
     - 自动把 CSS 样式内联到 JS，注入到 `<head>`
   - 通过 `scripts/copy-component.js`、`scripts/copy-status-toast.js`、`scripts/copy-modal.js`、`scripts/copy-button.js` 复制到 `static/bundles/`

构建输出：

- `static/bundles/react.js` - React 库（来自 `build:react-bundles`）
- `static/bundles/react-dom-client.js` - ReactDOM 客户端库（来自 `build:react-bundles`）
- `static/bundles/StatusToast.js` - StatusToast 组件
- `static/bundles/Modal.js` - Modal 对话框组件（Alert/Confirm/Prompt）
- `static/bundles/Button.js` - Button 基础按钮组件

### 在传统 HTML 中使用组件

#### 方式 1：ES Module 导入（推荐）

**ExampleButton 组件（示例，已废弃）：**

```html
<div id="example-button-container"></div>

<script type="module">
  import { ExampleButton } from "/static/bundles/ExampleButton.js"; // 仅示例，实际项目中已不再使用
  import React from "/static/bundles/react.js";
  import { createRoot } from "/static/bundles/react-dom-client.js";

  function mountComponent() {
    const container = document.getElementById("example-button-container");
    if (!container) return;
    const root = createRoot(container);
    root.render(
      React.createElement(ExampleButton, { // 示例用法
        buttonText: "打开 Modal",
        onSave: (text1, text2) => {
          console.log("保存的内容:", text1, text2);
        },
      })
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountComponent);
  } else {
    mountComponent();
  }
</script>
```

**StatusToast 组件：**

StatusToast 组件已集成到 React Router 主界面，同时支持全局 API 调用：

```html
<!-- 在 HTML 中提供容器 -->
<div id="status-toast"></div>

<!-- 加载 React bundles 和 StatusToast 组件 -->
<script type="module" src="/static/bundles/react.js"></script>
<script type="module" src="/static/bundles/react-dom-client.js"></script>
<script type="module" src="/static/bundles/StatusToast.js"></script>

<script>
  // 等待组件加载后，使用全局 API
  window.addEventListener('statusToastReady', () => {
    // 使用全局函数显示提示
    window.showStatusToast('消息内容', 3000);
  });
  
  // 或者直接调用（组件会自动处理延迟）
  window.showStatusToast('欢迎使用 N.E.K.O', 5000);
</script>
```

**Modal 组件：**

Modal 组件已集成到 `index.html` 主界面，提供三种对话框类型，支持全局 API 调用：

```html
<!-- 在 HTML 中提供容器 -->
<div id="modal-container" style="display: none;"></div>

<!-- 加载 React bundles 和 Modal 组件 -->
<script type="module">
  import { Modal } from "/static/bundles/Modal.js";
  import React from "/static/bundles/react.js";
  import { createRoot } from "/static/bundles/react-dom-client.js";
  
  // 挂载 Modal 组件
  function mountModal() {
    const container = document.getElementById("modal-container");
    if (container) {
      const root = createRoot(container);
      root.render(React.createElement(Modal));
    }
  }
  
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountModal);
  } else {
    mountModal();
  }
</script>

<script>
  // 使用全局 API（组件会自动暴露这些函数）
  
  // Alert 对话框
  await window.showAlert('这是一条提示消息', '提示');
  
  // Confirm 对话框（普通样式）
  const confirmed = await window.showConfirm('确定要执行此操作吗？', '确认');
  if (confirmed) {
    console.log('用户点击了确定');
  }
  
  // Confirm 对话框（危险操作样式）
  const deleteConfirmed = await window.showConfirm(
    '确定要删除吗？此操作不可恢复！',
    '删除确认',
    { danger: true }
  );
  
  // Prompt 对话框
  const input = await window.showPrompt(
    '请输入您的名称：',
    '默认值',
    '输入'
  );
  if (input) {
    console.log('用户输入:', input);
  }
</script>
```

> **注意**：Modal 组件会自动暴露 `window.showAlert`、`window.showConfirm`、`window.showPrompt` 全局函数，完全替代 `common_dialogs.js`。所有调用方式保持向后兼容。

#### 方式 2：通过全局 API 挂载（推荐用于复杂组件）

如果在组件的 `index.ts` 中暴露了全局 API，可以这样使用：

```html
<div id="my-component"></div>

<!-- React 依赖 -->
<script crossorigin src="https://unpkg.com/react@19/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@19/umd/react-dom.production.min.js"></script>

<!-- 组件脚本 -->
<script src="/static/my-component.js"></script>

<script>
  // 手动挂载
  if (window.ReactComponents?.MyComponent) {
    window.ReactComponents.MyComponent.mount('my-component', {
      // props
    });
  }
  
  // 或者使用组件提供的方法
  if (window.ReactComponents?.MyComponent?.show) {
    window.ReactComponents.MyComponent.show(message, duration);
  }
</script>
```

### 🔄 新旧代码通信（事件总线模式）

对于需要与 `static/app.js` 交互的组件，推荐使用事件总线：

> **注意**：事件总线工具尚未实现，如需使用请先创建 `app/utils/eventBus.ts`。

#### 1. 创建事件总线

`app/utils/eventBus.ts`（待创建）：

```typescript
class EventBus {
  private events: Map<string, Function[]> = new Map()

  on(event: string, callback: Function) {
    if (!this.events.has(event)) {
      this.events.set(event, [])
    }
    this.events.get(event)!.push(callback)
  }

  off(event: string, callback: Function) {
    const callbacks = this.events.get(event)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) callbacks.splice(index, 1)
    }
  }

  emit(event: string, ...args: any[]) {
    const callbacks = this.events.get(event)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(...args)
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error)
        }
      })
    }
  }
}

export const eventBus = new EventBus()

// 暴露到全局，供旧代码使用
if (typeof window !== 'undefined') {
  (window as any).EventBus = eventBus
}
```

#### 2. 在 React 组件中监听事件

```typescript
import { eventBus } from '~/utils/eventBus'

export function MyComponent() {
  useEffect(() => {
    const handleEvent = (data: any) => {
      // 处理来自旧代码的事件
    }
    
    eventBus.on('my-event', handleEvent)
    return () => eventBus.off('my-event', handleEvent)
  }, [])
  
  // ...
}
```

#### 3. 在旧代码中触发事件

```javascript
// static/app.js
if (window.EventBus) {
  window.EventBus.emit('my-event', { data: 'value' })
}
```

### 📋 组件模板（带全局 API）

当组件需要提供全局 API 供旧代码调用时，创建完整的 `index.ts`：

**app/components/MyComponent/MyComponent.tsx**:

```typescript
import React, { useState } from 'react'
import './MyComponent.css'

export interface MyComponentProps {
  initialValue?: string
  onSave?: (value: string) => void
}

export function MyComponent({ initialValue = '', onSave }: MyComponentProps) {
  const [value, setValue] = useState(initialValue)

  const handleSave = () => {
    onSave?.(value)
  }

  return (
    <div className="my-component p-4 bg-white rounded shadow">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full px-3 py-2 border rounded"
      />
      <button
        onClick={handleSave}
        className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Save
      </button>
    </div>
  )
}
```

**app/components/MyComponent/index.ts**:

```typescript
import React from 'react'
import { createRoot, Root } from 'react-dom/client'
import { MyComponent } from './MyComponent'
import './MyComponent.css'

declare global {
  interface Window {
    ReactComponents?: {
      MyComponent?: {
        mount: (containerId: string, props?: any) => void
        unmount: (containerId: string) => void
        update: (containerId: string, props: any) => void
      }
    }
  }
}

const mountedInstances = new Map<string, { root: Root, props: any }>()

function mount(containerId: string, props: any = {}) {
  const container = document.getElementById(containerId)
  if (!container) {
    console.error(`[MyComponent] Container #${containerId} not found`)
    return
  }

  if (mountedInstances.has(containerId)) {
    unmount(containerId)
  }

  const root = createRoot(container)
  root.render(<MyComponent {...props} />)
  mountedInstances.set(containerId, { root, props })
}

function unmount(containerId: string) {
  const instance = mountedInstances.get(containerId)
  if (instance) {
    instance.root.unmount()
    mountedInstances.delete(containerId)
  }
}

function update(containerId: string, props: any) {
  const instance = mountedInstances.get(containerId)
  if (instance) {
    const newProps = { ...instance.props, ...props }
    instance.root.render(<MyComponent {...newProps} />)
    mountedInstances.set(containerId, { ...instance, props: newProps })
  }
}

// 暴露到全局
if (typeof window !== 'undefined') {
  if (!window.ReactComponents) {
    window.ReactComponents = {}
  }
  window.ReactComponents.MyComponent = { mount, unmount, update }
}

// 自动挂载（如果容器存在）
if (typeof document !== 'undefined') {
  const container = document.getElementById('my-component')
  if (container) {
    mount('my-component')
  }
}
```

### 🔧 添加新组件到构建

#### 方式 1: 修改 vite.components.config.ts（多入口）

如果需要构建多个独立组件：

```typescript
// vite.components.config.ts
export default defineConfig({
  // ...
  build: {
    lib: {
      entry: {
        MyComponent: resolve(__dirname, "app/components/MyComponent/index.ts"),
        AnotherComponent: resolve(__dirname, "app/components/AnotherComponent/index.ts"),
      },
      formats: ["es"],
    },
    // ...
  },
})
```

然后更新 `scripts/copy-component.js` 来复制所有组件。

#### 方式 2: 单独构建配置（推荐用于大型项目）

为每个组件创建独立的构建配置：

```bash
# 创建组件专属配置
cp vite.components.config.ts vite.my-component.config.ts

# 修改 entry 指向你的组件
# 添加对应的 npm script
```

**package.json**:
```json
{
  "scripts": {
    "build:component": "vite build --config vite.components.config.ts && npm run copy:component",
    "build:my-component": "vite build --config vite.my-component.config.ts && npm run copy:my-component"
  }
}
```

### 📊 渐进式迁移优先级

#### 第一阶段：独立组件（低风险）
1. ✅ **StatusToast** - 独立显示，无复杂交互（已完成 ✅）
   - 已集成到 React Router 主界面
   - 支持全局 `window.showStatusToast()` API
   - 已构建为独立组件，可在传统 HTML 中使用
2. ✅ **Modal/Dialog** - 独立弹窗组件（已完成 ✅）
   - 已集成到 `index.html` 主界面
   - 支持全局 `window.showAlert()`, `window.showConfirm()`, `window.showPrompt()` API
   - 已构建为独立组件 (`static/bundles/Modal.js`)
   - 完全替代 `common_dialogs.js`，向后兼容
   - 支持三种对话框类型：Alert、Confirm（含危险操作样式）、Prompt
   - 完整的交互功能：ESC 键关闭、点击遮罩关闭、自动焦点管理
3. ✅ Button - 基础 UI 组件（已完成 ✅）
   - 已在 React Router 主界面用于对话区按钮
   - 已构建为独立组件 (`static/bundles/Button.js`)，可按需在传统 HTML 中使用

#### 第二阶段：中等复杂度组件
1. ⚠️ ChatContainer - 需要 WebSocket 集成
2. ⚠️ ScreenshotThumbnails - 需要文件处理

#### 第三阶段：复杂组件
1. 🔴 Live2DCanvas - 需要 PIXI.js 集成
2. 🔴 VoiceControl - 需要 WebRTC 集成

### ⚠️ 注意事项

1. **React 版本一致性** - 确保所有组件使用相同版本（当前：React 19）
2. **样式隔离** - 使用 CSS 模块或 Tailwind 的作用域类名
3. **状态管理** - 组件间通信优先使用事件总线
4. **性能考虑** - 按需加载，避免重复打包 React
5. **向后兼容** - 保留旧代码作为降级方案
6. **CDN vs 本地** - 考虑使用 CDN 加载 React/ReactDOM 以减小包体积

### 🎓 开发最佳实践

#### 1. 组件设计原则

- **单一职责**: 每个组件只做一件事
- **Props 明确**: 使用 TypeScript 定义清晰的接口
- **可复用性**: 设计时考虑在多个场景使用
- **降级方案**: 对于关键功能，保留非 React 的降级方案

#### 2. 性能优化

```typescript
// 使用 React.memo 避免不必要的重渲染
export const MyComponent = React.memo(({ data }: Props) => {
  // ...
})

// 使用 useMemo 缓存计算结果
const expensiveValue = useMemo(() => computeExpensiveValue(data), [data])

// 使用 useCallback 缓存函数
const handleClick = useCallback(() => {
  // ...
}, [dependency])
```

#### 3. 类型安全

```typescript
// 定义清晰的 Props 接口
export interface MyComponentProps {
  title: string                    // 必需
  count?: number                   // 可选
  onSave?: (data: string) => void  // 回调
  children?: React.ReactNode       // 子元素
}

// 使用泛型
export function MyList<T>({ items, renderItem }: {
  items: T[]
  renderItem: (item: T) => React.ReactNode
}) {
  return <ul>{items.map(renderItem)}</ul>
}
```

#### 4. 错误处理

```typescript
// 组件内部错误处理
export function MyComponent() {
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    try {
      // 可能出错的操作
    } catch (err) {
      setError(err as Error)
      console.error('[MyComponent] Error:', err)
    }
  }, [])

  if (error) {
    return <div className="error">出错了: {error.message}</div>
  }

  return <div>正常内容</div>
}
```

#### 5. 调试技巧

```typescript
// 开发模式下添加调试信息
if (import.meta.env.DEV) {
  console.log('[MyComponent] Props:', props)
  console.log('[MyComponent] State:', state)
}

// 使用 React DevTools
// 安装浏览器扩展: React Developer Tools

// 性能分析
import { Profiler } from 'react'

<Profiler id="MyComponent" onRender={(id, phase, actualDuration) => {
  console.log(`${id} (${phase}) took ${actualDuration}ms`)
}}>
  <MyComponent />
</Profiler>
```

### 📚 常见问题 (FAQ)

#### Q1: 如何在旧代码中调用 React 组件？

**A**: 使用全局 API：

```javascript
// 旧代码 (static/app.js)
if (window.ReactComponents?.MyComponent) {
  window.ReactComponents.MyComponent.mount('container-id', { prop: 'value' })
}
```

#### Q2: React 组件如何访问旧代码的全局变量？

**A**: 直接通过 window 对象：

```typescript
// React 组件中
const oldValue = (window as any).someGlobalVariable

// 建议在 global.d.ts 中添加类型
declare global {
  interface Window {
    someGlobalVariable?: string
  }
}
```

#### Q3: 如何调试组件没有正确挂载？

**A**: 检查以下几点：

1. 容器元素是否存在：`document.getElementById('container-id')`
2. React/ReactDOM 是否正确加载
3. 组件 JS 文件是否加载（查看 Network 面板）
4. 查看浏览器控制台错误信息
5. 确认构建输出是否正确

#### Q4: 样式没有生效怎么办？

**A**: 

1. 确认 CSS 文件已导入：`import './MyComponent.css'`
2. 检查 Tailwind 配置：CSS 中是否有 `@import "tailwindcss"`
3. 查看构建输出，确认样式已注入
4. 检查样式是否被其他样式覆盖（使用浏览器开发者工具）

#### Q5: 如何处理组件之间的通信？

**A**: 使用事件总线：

```typescript
// 组件 A 发送事件
eventBus.emit('data-updated', { id: 1, value: 'new' })

// 组件 B 监听事件
useEffect(() => {
  const handler = (data) => console.log(data)
  eventBus.on('data-updated', handler)
  return () => eventBus.off('data-updated', handler)
}, [])
```

---

## 与 `static/` 下旧版 JS 的协作方式（重要）

`app/routes/main.tsx` 做了大量「桥接工作」，把现代 React 环境与旧版 `static/*.js` 串起来，核心点包括：

- **全局工具函数与变量**
  - `window.buildApiUrl` / `window.fetchWithBaseUrl`
  - `window.API_BASE_URL`、`window.STATIC_SERVER_URL`
  - `window.pageConfigReady`（异步加载 `/api/config/page_config`）
  - 全局菜单状态：`window.activeMenuCount`、`markMenuOpen`、`markMenuClosed`
- **静态资源路径重写**
  - 拦截 `HTMLImageElement.src` / `Element.setAttribute('src')`
  - 拦截 `style.cssText` / `backgroundImage` 等 CSS 属性
  - 自动把 `/static/...` 替换为基于 `VITE_STATIC_SERVER_URL` 的完整 URL
- **错误与日志处理（开发模式）**
  - 拦截 `console.error` 和 `window.onerror`，静默忽略 static 资源加载失败
- **Beacon 与跨页面通信**
  - 页面关闭时向 `/api/beacon/shutdown` 发送 `navigator.sendBeacon`
  - 通过 `localStorage` + `storage` 事件与设置页面通信，动态隐藏/显示主 UI 以及重新加载 Live2D 模型

修改这部分逻辑时，建议：

- 保持 `window.*` 的对外行为稳定（避免破坏 `static/*.js`）
- 如果新增全局变量或方法，同时在 `global.d.ts` 中补充类型声明

---

## 组件与样式约定

- **组件路径**：`app/components/`
- **样式**：默认使用 Tailwind CSS v4；
  - 若组件单独构建（如 `ExampleButton`），需要：
    - 在组件文件中显式导入 CSS：`import "./ComponentName.css";`
    - CSS 中包含 `@import "tailwindcss";`

---

## 技术栈

- **React Router v7**：React 框架（路由 + SPA 模式）
- **React 19**：UI 库
- **TypeScript**：类型安全
- **Tailwind CSS v4**：样式系统
- **Vite 7**：构建工具（主应用 & 组件构建）

## 架构说明

### SPA 模式（当前）

- ✅ **纯客户端渲染** - 所有渲染在浏览器中进行
- ✅ **无需 Node 服务器** - 只需静态文件服务
- ✅ **简化部署** - 直接部署到静态服务器
- ✅ **开发简单** - 无需处理 SSR 复杂性

### 为什么选择 SPA 而不是 SSR？

1. **简化部署** - N.E.K.O 是桌面应用，不需要 SEO
2. **降低复杂度** - 无需维护 Node SSR 服务器
3. **更好的集成** - 与现有 FastAPI 后端更容易集成
4. **开发效率** - 减少服务端/客户端状态同步问题

### 如果未来需要 SSR？

只需将 `react-router.config.ts` 中的 `ssr: false` 改为 `ssr: true`，并安装相应依赖：
```bash
npm install @react-router/node @react-router/serve isbot
```

---

## 📚 相关文档

- **[REACT_REFACTOR_PLAN.md](./REACT_REFACTOR_PLAN.md)** - 重构计划与进度跟踪

---

## 🤝 贡献指南

### 开发流程

1. **创建功能分支**
   ```bash
   git checkout -b feature/my-component
   ```

2. **开发组件**
   - 遵循上述组件开发指南
   - 添加必要的类型定义
   - 编写清晰的注释

3. **测试**
   ```bash
   npm run dev        # 开发测试
   npm run build      # 构建测试
   npm run typecheck  # 类型检查
   ```

4. **提交代码**
   ```bash
   git add .
   git commit -m "feat: add MyComponent"
   ```

### 代码规范

- 使用 TypeScript，避免使用 `any`
- 组件名使用 PascalCase
- 函数名使用 camelCase
- 常量使用 UPPER_SNAKE_CASE
- 添加必要的 JSDoc 注释

---

如需后续对 README 做更细的中文说明（比如面向非开发者的部署/使用文档），可以再单独拆一份到 `docs/` 或上层项目的文档中。
