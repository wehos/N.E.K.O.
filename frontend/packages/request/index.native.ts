import { createRequestClient } from "./createClient";
import { NativeTokenStorage } from "./src/request-client/tokenStorage";
import type { TokenRefreshFn } from "./src/request-client/types";

/**
 * Creates a request client configured for React Native environments.
 *
 * @param options.baseURL - Base URL to use for API requests.
 * @param options.refreshApi - Callback used to refresh authentication tokens.
 * @returns A request client instance configured with NativeTokenStorage and the provided baseURL and refreshApi.
 */
export function createNativeRequestClient(options: { baseURL: string; refreshApi: TokenRefreshFn }) {
  return createRequestClient({
    baseURL: options.baseURL,
    storage: new NativeTokenStorage(),
    refreshApi: options.refreshApi
  });
}

// 导出类型和工具
export { createRequestClient } from "./createClient";
export { NativeTokenStorage } from "./src/request-client/tokenStorage";
export type { RequestClientConfig, TokenStorage, TokenRefreshFn, TokenRefreshResult } from "./src/request-client/types";
