import { createRequestClient } from "./createClient";
import { NativeTokenStorage } from "./src/request-client/tokenStorage";
import type { TokenRefreshFn } from "./src/request-client/types";
import { getApiBaseUrl } from "../../../app/api/config";

/**
 * React Native 环境的请求客户端实例
 */
export const request = createRequestClient({
    baseURL: getApiBaseUrl(),
    storage: new NativeTokenStorage(),
    refreshApi: async (refreshToken: string) => {
        const base = getApiBaseUrl().replace(/\/$/, '');
        const url = `${base}/auth/refresh`;

        const res = await fetch(url, {
            method: "POST",
            body: JSON.stringify({ refreshToken }),
            headers: { "Content-Type": "application/json" },
        }).then(r => r.json());

        return {
            accessToken: res.access_token,
            refreshToken: res.refresh_token,
        };
    }
});

// 导出类型和工具
export { createRequestClient } from "./createClient";
export { NativeTokenStorage } from "./src/request-client/tokenStorage";
export type { RequestClientConfig, TokenStorage, TokenRefreshFn, TokenRefreshResult } from "./src/request-client/types";
