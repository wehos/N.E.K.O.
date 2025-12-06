/**
 * 统一配置管理模块
 * 用于 React 项目（TypeScript 源码）
 */

/**
 * 获取 API 基础 URL
 * 优先级：window.API_BASE_URL > 环境变量 > 默认值
 */
export function getApiBaseUrl(): string {
  // 浏览器环境：优先从 window 获取（HTML 中设置）
  if (typeof window !== 'undefined' && window.API_BASE_URL) {
    return window.API_BASE_URL;
  }
  
  // 构建时环境变量（React 项目）
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL as string;
  }
  
  // 默认值
  return 'http://localhost:48911';
}

/**
 * 获取静态资源服务器 URL
 * 优先级：window.STATIC_SERVER_URL > 环境变量 > API_BASE_URL
 */
export function getStaticServerUrl(): string {
  // 浏览器环境：优先从 window 获取
  if (typeof window !== 'undefined' && window.STATIC_SERVER_URL) {
    return window.STATIC_SERVER_URL;
  }
  
  // 构建时环境变量
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_STATIC_SERVER_URL) {
    return import.meta.env.VITE_STATIC_SERVER_URL as string;
  }
  
  // 默认使用 API_BASE_URL
  return getApiBaseUrl();
}

/**
 * 获取 WebSocket URL
 * 优先级：window.WEBSOCKET_URL > 环境变量 > API_BASE_URL
 */
export function getWebSocketUrl(): string {
  // 浏览器环境：优先从 window 获取
  if (typeof window !== 'undefined' && window.WEBSOCKET_URL) {
    return window.WEBSOCKET_URL;
  }
  
  // 构建时环境变量
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WEBSOCKET_URL) {
    return import.meta.env.VITE_WEBSOCKET_URL as string;
  }
  
  // 默认值 使用 API_BASE_URL 构建 WebSocket URL
  return getApiBaseUrl().replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://');
}


/**
 * 构建完整的 API URL
 * @param path - API 路径（如 '/api/users' 或 'api/users'）
 * @returns 完整的 URL
 */
export function buildApiUrl(path: string): string {
  // 如果已经是完整 URL，直接返回
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  const baseURL = getApiBaseUrl();
  const base = baseURL.replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

/**
 * 构建完整的静态资源 URL
 * @param path - 静态资源路径（如 '/static/icon.png' 或 'static/icon.png'）
 * @returns 完整的 URL
 */
export function buildStaticUrl(path: string): string {
  // 如果已经是完整 URL，直接返回
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  // 统一规范路径前缀
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  /**
   * 仅对明确的静态资源前缀做「拼接静态服务器域名」处理：
   * - /static/...
   * - /user_live2d/...
   *
   * 这样可以避免误把其他业务路径/相对路径强行挂到静态域名下，
   * 同时与传统 HTML/JS 中的 Live2D 等脚本使用习惯保持一致。
   */
  if (cleanPath.startsWith('/static/') || cleanPath.startsWith('/user_live2d/')) {
    const baseURL = getStaticServerUrl();
    const base = baseURL.replace(/\/$/, '');
    return `${base}${cleanPath}`;
  }

  // 其他路径保持原样（只做前导 / 规范化），交由调用方自行决定是否需要拼绝对 URL
  return cleanPath;
}

/**
 * 构建 WebSocket URL
 * @param path - WebSocket 路径（如 '/ws/chat' 或 'ws/chat'）
 * @returns WebSocket URL（ws:// 或 wss://）
 */
export function buildWebSocketUrl(path: string): string {
  const httpUrl = buildApiUrl(path);
  // 将 http:// 替换为 ws://，https:// 替换为 wss://
  return httpUrl.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://');
}
