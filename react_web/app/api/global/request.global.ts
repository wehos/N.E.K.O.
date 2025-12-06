/**
 * 全局 Request 初始化脚本
 * 用于在静态 HTML 中独立使用，打包成 request.global.js
 *
 * 源码放在 app/api/global 下，避免与 React 公共 request 混淆。
 * 仅负责把公共 request/config 挂到 window 上，不重新实现客户端逻辑。
 */

import {
  getApiBaseUrl,
  getStaticServerUrl,
  getWebSocketUrl,
  buildApiUrl,
  buildStaticUrl,
  buildWebSocketUrl,
} from '../config';
import { request } from '../request';

/**
 * 创建并初始化全局 request 实例
 */
function initRequest() {
  if (typeof window === 'undefined') {
    console.warn('[Request] 非浏览器环境，跳过初始化');
    return;
  }

  // 暴露到全局
  const win = window as any;
  win.request = request;
  win.buildApiUrl = buildApiUrl;
  win.buildStaticUrl = buildStaticUrl;
  win.buildWebSocketUrl = buildWebSocketUrl;
  win.API_BASE_URL = getApiBaseUrl();
  win.STATIC_SERVER_URL = getStaticServerUrl();
  win.WEBSOCKET_URL = getWebSocketUrl();

  console.log('[Request] request 实例和工具函数已暴露到全局');
  console.log('[Request] 初始化完成:', {
    API_BASE_URL: win.API_BASE_URL,
    STATIC_SERVER_URL: win.STATIC_SERVER_URL,
    WEBSOCKET_URL: win.WEBSOCKET_URL
  });
}

// 自动初始化
if (typeof window !== 'undefined') {
  // 如果 DOM 已加载，立即初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRequest);
  } else {
    initRequest();
  }
}

// 导出供外部使用（如果需要）
export { initRequest, buildApiUrl, buildStaticUrl, buildWebSocketUrl };


