# 统一 Request 库使用指南

## 📦 构建（概要）

- 构建命令、产物目录结构、互斥关系等完整说明，请参见 **`BUILD_GUIDE.md`**。
- 本文只关注「构建完成之后如何在 HTML/JS 与 React 中使用」。

## 🚀 在 HTML/JS 中使用

### 方式 1：使用统一库（推荐）

```html
<!DOCTYPE html>
<html>
<head>
  <script>
    // 1. 设置配置（可选，有默认值）
    window.API_BASE_URL = 'http://localhost:48911';
    window.STATIC_SERVER_URL = window.API_BASE_URL;
  </script>
  
  <!-- 2. 加载库（注意加载顺序和脚本类型） -->
  <!-- 初始化工具（IIFE 格式，普通 script 标签） -->
  <script src="/static/bundles/react_init.js"></script>
  <!-- Request 库（ES Module 格式） -->
  <script type="module" src="/static/bundles/request.global.js"></script>
  <!-- 首页 API 封装（ES Module 格式，可选） -->
  <script type="module" src="/static/bundles/request.api.global.js"></script>
</head>
<body>
  <script>
    // 等待库加载完成
    window.addEventListener('load', async () => {
      // 方式 1：使用 window.ReactInit 等待初始化（推荐）
      if (window.ReactInit) {
        await window.ReactInit.waitForRequestInit();
        await window.ReactInit.waitForRequestAPIInit();
      }
      
      // 使用 window.request 发起请求
      window.request.get('/api/users')
        .then(data => console.log('Users:', data))
        .catch(error => console.error('Error:', error));
      
      // 使用工具函数构建 URL
      const apiUrl = window.buildApiUrl('/api/users');
      const staticUrl = window.buildStaticUrl('/static/icon.png');
      const wsUrl = window.buildWebSocketUrl('/ws/chat');
      
      console.log('API URL:', apiUrl);
      console.log('Static URL:', staticUrl);
      console.log('WebSocket URL:', wsUrl);
      
      // 使用 WebSocket
      const ws = new WebSocket(wsUrl);
      ws.onopen = () => console.log('WebSocket connected');
      
      // 使用 window.RequestAPI（如果已加载 request.api.global.js）
      if (window.RequestAPI) {
        window.RequestAPI.getPageConfig()
          .then(config => console.log('页面配置:', config))
          .catch(error => console.error('Error:', error));
      }
    });
  </script>
</body>
</html>
```

### 方式 2：仅使用工具函数（不依赖 React）

如果只需要 URL 构建功能，不需要完整的 React 前端：

```html
<script>
  window.API_BASE_URL = 'http://localhost:48911';
  window.STATIC_SERVER_URL = window.API_BASE_URL;
</script>
<script src="/static/bundles/react_init.js"></script>
<script type="module" src="/static/bundles/request.global.js"></script>
<script type="module">
  // 等待 request 初始化
  if (window.ReactInit) {
    await window.ReactInit.waitForRequestInit();
  }
  
  // 使用配置工具函数
  const apiUrl = window.buildApiUrl('/api/users');
  const wsUrl = window.buildWebSocketUrl('/ws/chat');
  
  // 使用原生 fetch
  fetch(apiUrl).then(r => r.json()).then(console.log);
  
  // 使用 WebSocket
  const ws = new WebSocket(wsUrl);
</script>
```

## ⚛️ 在 React 项目中使用

### 导入 Request 实例

```typescript
// app/routes/some-route.tsx
import { useEffect } from 'react';
import { request, buildApiUrl, buildStaticUrl, buildWebSocketUrl } from '~/api/request';

export default function SomeRoute() {
  useEffect(() => {
    // 使用 request 实例
    request.get('/api/users')
      .then(data => console.log('Users:', data))
      .catch(error => console.error('Error:', error));
    
    // 使用工具函数
    const apiUrl = buildApiUrl('/api/users');
    const staticUrl = buildStaticUrl('/static/icon.png');
    const wsUrl = buildWebSocketUrl('/ws/chat');
  }, []);
  
  return <div>...</div>;
}
```

### 导入配置函数

```typescript
// app/utils/websocket.ts
import { buildWebSocketUrl } from '~/api/config';

export function createWebSocketConnection(path: string) {
  const wsUrl = buildWebSocketUrl(path);
  return new WebSocket(wsUrl);
}
```

## 🔧 配置优先级

配置读取的优先级（从高到低）：

1. **window.API_BASE_URL** / **window.STATIC_SERVER_URL**（HTML 中设置）
2. **环境变量**（VITE_API_BASE_URL / VITE_STATIC_SERVER_URL）
3. **默认值**（`http://localhost:48911`）

## 📝 API 参考

### window.request

Axios 实例，支持所有 Axios API：

```javascript
// GET 请求
window.request.get('/api/users')
window.request.get('/api/users', { params: { page: 1 } })

// POST 请求
window.request.post('/api/users', { name: 'John' })

// PUT 请求
window.request.put('/api/users/1', { name: 'Jane' })

// DELETE 请求
window.request.delete('/api/users/1')
```

**注意**：`window.request` 会自动处理 token 刷新，401 错误时会自动尝试刷新 access token。

### window.RequestAPI

首页 API 封装命名空间（需要加载 `request.api.global.js`）：

```javascript
// 页面配置
const config = await window.RequestAPI.getPageConfig('LanLan1');

// 角色配置
const characters = await window.RequestAPI.getCharacters();
const catgirlConfig = await window.RequestAPI.getCurrentCatgirlConfig('LanLan1');

// Live2D 模型
const models = await window.RequestAPI.getLive2DModels();
const model = await window.RequestAPI.findLive2DModelByName('model_name');

// 用户偏好
const preferences = await window.RequestAPI.getUserPreferences();
await window.RequestAPI.saveUserPreferences(modelPath, position, scale);

// Agent 控制
const health = await window.RequestAPI.checkAgentHealth();
const flags = await window.RequestAPI.getAgentFlags();
await window.RequestAPI.setAgentFlags('LanLan1', { someFlag: true });

// 更多 API 请参考 global.d.ts 中的类型定义
```

### window.ReactInit

初始化工具命名空间（通过 `react_init.js` 暴露）：

```javascript
// 等待 request.global.js 初始化完成
await window.ReactInit.waitForRequestInit(5000); // 最多等待 5 秒

// 等待 request.api.global.js 初始化完成
await window.ReactInit.waitForRequestAPIInit(5000);

// 检查 request 相关全局对象是否已初始化（调试用）
window.ReactInit.checkRequestAvailable();
```

### window.buildApiUrl(path: string)

构建完整的 API URL。

```javascript
buildApiUrl('/api/users')           // -> 'http://localhost:48911/api/users'
buildApiUrl('api/users')             // -> 'http://localhost:48911/api/users'
buildApiUrl('http://example.com/api') // -> 'http://example.com/api' (完整 URL 直接返回)
```

### window.buildStaticUrl(path: string)

构建完整的静态资源 URL。

```javascript
buildStaticUrl('/static/icon.png')   // -> 'http://localhost:48911/static/icon.png'
buildStaticUrl('static/icon.png')    // -> 'http://localhost:48911/static/icon.png'
```

### window.buildWebSocketUrl(path: string)

构建 WebSocket URL（自动转换 http -> ws, https -> wss）。

```javascript
buildWebSocketUrl('/ws/chat')        // -> 'ws://localhost:48911/ws/chat'
buildWebSocketUrl('/api/ws')         // -> 'ws://localhost:48911/api/ws'
```

## 🔄 迁移指南

### 从 api_interceptor.js 迁移

**旧方式**（使用拦截器）：
```javascript
// 自动拦截，无需手动处理
fetch('/api/users')  // 自动添加 API_BASE_URL
new WebSocket('/ws/chat')  // 自动添加 API_BASE_URL
```

**新方式**（使用工具函数）：
```javascript
// 方式 1：使用 request 库（推荐）
window.request.get('/api/users')

// 方式 2：使用工具函数
fetch(window.buildApiUrl('/api/users'))
new WebSocket(window.buildWebSocketUrl('/ws/chat'))
```

### 从直接 fetch 迁移

**旧方式**：
```javascript
fetch('http://localhost:48911/api/users')
  .then(r => r.json())
  .then(data => console.log(data));
```

**新方式**：
```javascript
// 方式 1：使用 request（自动处理 JSON，统一错误处理）
window.request.get('/api/users')
  .then(data => console.log(data))
  .catch(error => console.error(error));

// 方式 2：使用工具函数 + fetch
fetch(window.buildApiUrl('/api/users'))
  .then(r => r.json())
  .then(data => console.log(data));
```

## ⚠️ 注意事项

1. **加载顺序**：
   - 先设置 `window.API_BASE_URL`（如果需要自定义）
   - 然后加载 `react_init.js`（IIFE 格式，普通 script 标签）
   - 再加载 `request.global.js`（ES Module 格式，需要 `type="module"`）
   - 最后加载 `request.api.global.js`（ES Module 格式，可选）

2. **脚本类型**：
   - `react_init.js` 是 IIFE 格式，使用 `<script src="..."></script>`
   - `request.global.js` 和 `request.api.global.js` 是 ES Module 格式，使用 `<script type="module" src="..."></script>`

3. **等待初始化**：由于 ES Module 是异步加载的，建议使用 `window.ReactInit.waitForRequestInit()` 等待初始化完成后再使用 `window.request`

4. **构建路径**：所有构建产物位于 `static/bundles/` 目录，便于全量构建时清理

5. **构建推荐**：统一使用 `build:global` + `build:component` 或 `build:all`，不再单独构建 request

6. **向后兼容**：`api_interceptor.js` 仍然可以继续使用，但建议逐步迁移到新方式

7. **TypeScript**：React 项目中使用 TypeScript 源码，享受类型检查和自动补全

## 🐛 故障排除

### 问题：`window.request is undefined`

**原因**：ES Module 是异步加载的，库还未加载完成。

**解决**：
```javascript
// 方式 1：使用 ReactInit 等待初始化（推荐）
window.addEventListener('load', async () => {
  if (window.ReactInit) {
    await window.ReactInit.waitForRequestInit();
  }
  
  if (window.request) {
    // 使用 window.request
  } else {
    console.error('request.global.js 未正确加载');
  }
});

// 方式 2：轮询检查
window.addEventListener('load', () => {
  const checkRequest = setInterval(() => {
    if (window.request) {
      clearInterval(checkRequest);
      // 使用 window.request
    }
  }, 50);
  
  // 超时处理
  setTimeout(() => {
    clearInterval(checkRequest);
    if (!window.request) {
      console.error('request.global.js 加载超时');
    }
  }, 5000);
});
```

### 问题：URL 构建不正确

**原因**：配置未正确设置。

**解决**：
```javascript
// 检查配置
console.log('API_BASE_URL:', window.API_BASE_URL);
console.log('STATIC_SERVER_URL:', window.STATIC_SERVER_URL);

// 手动设置
window.API_BASE_URL = 'http://localhost:48911';
window.STATIC_SERVER_URL = window.API_BASE_URL;
```

