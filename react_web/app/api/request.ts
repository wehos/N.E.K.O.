/**
 * 请求客户端配置（React / TypeScript 专用）
 * 
 * 约定：
 * - 仅在 React 代码中通过 `import { request } from '~/api/request'` 使用
 * - 不做任何 window 挂载、全局暴露等操作
 * - 所有「全局 JS」相关逻辑统一放在 `request.global.ts` / `react_init.ts` 中
 */

import { createRequestClient, WebTokenStorage } from '@project_neko/request';
import { getApiBaseUrl, buildApiUrl, buildStaticUrl, buildWebSocketUrl } from './config';

/**
 * 创建并导出请求客户端实例
 */
export const request = createRequestClient({
  baseURL: getApiBaseUrl(),
  storage: new WebTokenStorage(),
  refreshApi: async (refreshToken: string) => {
    // 规范化 baseURL，避免出现重复的 /api 片段
    const rawBaseURL = getApiBaseUrl();
    const normalizedBaseURL = rawBaseURL.replace(/\/+$/, '');

    // 当 base 已经是以 /api 结尾时，只追加 /auth/refresh
    // 否则追加 /api/auth/refresh，保证最终路径中只出现一次 /api
    const refreshUrl = normalizedBaseURL.endsWith('/api')
      ? `${normalizedBaseURL}/auth/refresh`
      : `${normalizedBaseURL}/api/auth/refresh`;

    try {
      const response = await fetch(refreshUrl, {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        let errorBody: unknown;
        try {
          errorBody = await response.json();
        } catch {
          // 如果解析失败则忽略，使用通用错误信息
        }

        const message =
          (errorBody as any)?.message ??
          `Failed to refresh token: ${response.status} ${response.statusText}`;

        const error = new Error(message);
        (error as any).status = response.status;
        throw error;
      }

      const data: any = await response.json();

      if (
        !data ||
        typeof data.access_token !== 'string' ||
        typeof data.refresh_token !== 'string'
      ) {
        throw new Error('Invalid token refresh response payload');
      }

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      };
    } catch (err) {
      // 将错误向上传递，让上层统一处理（如跳转登录、提示等）
      console.error('Token refresh request failed', err);
      throw err;
    }
  },
  // 可选配置
  timeout: 15000,
  returnDataOnly: true,
  // 自定义错误处理
  errorHandler: async (error) => {
    // 可以在这里进行错误上报或统一处理
    if (error.response?.status === 403) {
      // 处理 403 错误，例如跳转到登录页
      console.warn('Access forbidden, redirecting to login...');
    }
  },
});

// 导出类型（React 代码可以按需引用）
export type { RequestClientConfig, TokenStorage, TokenRefreshFn } from '@project_neko/request';

// 导出配置工具函数（从 config.ts 重新导出），供 React 端直接使用
export { buildApiUrl, buildStaticUrl, buildWebSocketUrl };

