import axios from "axios";
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from "axios";
import createAuthRefreshInterceptor from "axios-auth-refresh";
import type { RequestClientConfig, TokenStorage, TokenRefreshFn } from "./src/request-client/types";
import { RequestQueue } from "./src/request-client/requestQueue";

/**
 * 检查是否启用请求日志
 * 根据构建模式（mode）决定：开发模式启用，生产模式禁用
 */
const isRequestLogEnabled = (): boolean => {
  try {
    const env = (import.meta as any)?.env;
    // 根据 MODE 或 NODE_ENV 判断：development 启用，production 禁用
    const mode = env?.MODE || env?.NODE_ENV || 'development';
    return mode === 'development';
  } catch {
    // 如果无法读取环境变量，默认启用（开发环境）
    return true;
  }
};

const REQUEST_LOG_ENABLED = isRequestLogEnabled();

/**
 * 创建统一的请求客户端
 * 支持 Axios、Token 刷新、请求队列、Web/RN 通用存储
 */
export function createRequestClient(options: RequestClientConfig): AxiosInstance {
  const {
    baseURL,
    storage,
    refreshApi,
    timeout = 15000,
    requestInterceptor,
    responseInterceptor,
    returnDataOnly = true,
    errorHandler
  } = options;

  // 创建 Axios 实例
  const instance = axios.create({
    baseURL,
    timeout,
    headers: {
      "Content-Type": "application/json"
    }
  });

  // 创建请求队列管理器
  const requestQueue = new RequestQueue();

  /**
   * Request 拦截器：自动添加 access_token
   */
  instance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      // 记录请求日志（仅在启用时）
      if (REQUEST_LOG_ENABLED) {
        const method = config.method?.toUpperCase() || 'GET';
        const url = config.url || '';
        const fullUrl = config.baseURL ? `${config.baseURL}${url}` : url;
        
        const logInfo: Record<string, unknown> = {};
        if (config.params) {
          const paramsStr = JSON.stringify(config.params);
          logInfo.params = paramsStr.length > 200 ? paramsStr.substring(0, 200) + '...' : paramsStr;
        }
        if (config.data) {
          const dataStr = typeof config.data === 'string' ? config.data : JSON.stringify(config.data);
          logInfo.data = dataStr.length > 200 ? dataStr.substring(0, 200) + '...' : dataStr;
        }
        
        console.log(`[Request] ${method} ${fullUrl}`, Object.keys(logInfo).length > 0 ? logInfo : '');
      }

      // 如果正在刷新 token，将请求加入队列
      if (requestQueue.getIsRefreshing()) {
        return new Promise<InternalAxiosRequestConfig>((resolve, reject) => {
          requestQueue.enqueue({
            resolve: async (cfg) => {
              // 添加最新 access token
              const token = await storage.getAccessToken();
              if (token && cfg.headers) {
                cfg.headers.Authorization = `Bearer ${token}`;
              }

              // 执行自定义请求拦截器
              if (requestInterceptor) {
                resolve(await requestInterceptor(cfg));
              } else {
                resolve(cfg);
              }
            },
            reject,
            config
          });
        });
      }

      // 添加 access token
      const token = await storage.getAccessToken();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // 执行自定义请求拦截器
      if (requestInterceptor) {
        return await requestInterceptor(config);
      }

      return config;
    },
    (error: AxiosError) => {
      if (REQUEST_LOG_ENABLED) {
        console.error('[Request] 请求拦截器错误:', error);
      }
      return Promise.reject(error);
    }
  );

  /**
   * Token 刷新拦截器：401 时自动刷新 token
   */
  createAuthRefreshInterceptor(
    instance,
    async (failedRequest: AxiosError<any>) => {
      // 记录进入时是否已经在刷新，避免覆盖进行中的刷新 Promise
      const wasRefreshing = requestQueue.getIsRefreshing();
      const refreshPromise = requestQueue.startRefresh();

      // 已在刷新：只需等待既有刷新完成，然后使用新 token 重试
      if (wasRefreshing) {
        try {
          await refreshPromise;
          const newToken = await storage.getAccessToken();
          if (newToken && failedRequest.config?.headers) {
            failedRequest.config.headers.Authorization = `Bearer ${newToken}`;
          }
          return Promise.resolve();
        } catch (error) {
          return Promise.reject(error);
        }
      }

      try {
        const refreshToken = await storage.getRefreshToken();
        if (!refreshToken) {
          throw new Error("No refresh token available");
        }

        // 调用刷新 API
        const newTokens = await refreshApi(refreshToken);

        // 保存新 token
        await storage.setAccessToken(newTokens.accessToken);
        await storage.setRefreshToken(newTokens.refreshToken);

        // 更新失败请求的 header
        if (failedRequest.config?.headers) {
          failedRequest.config.headers.Authorization = `Bearer ${newTokens.accessToken}`;
        }

        // 完成刷新，处理队列中的请求
        await requestQueue.finishRefresh();

        return Promise.resolve();
      } catch (error) {
        // 刷新失败，清空 token 并处理队列
        await storage.clearTokens();
        await requestQueue.finishRefreshWithError(error);
        return Promise.reject(error);
      }
    },
    {
      statusCodes: [401], // 只在 401 时触发刷新
      skipWhileRefreshing: false // 允许在刷新期间处理其他请求
    }
  );

  /**
   * Response 拦截器：统一响应格式和错误处理
   */
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      // 记录响应日志（仅在启用时）
      if (REQUEST_LOG_ENABLED) {
        const method = response.config.method?.toUpperCase() || 'GET';
        const url = response.config.url || '';
        const fullUrl = response.config.baseURL ? `${response.config.baseURL}${url}` : url;
        const status = response.status;
        
        let responseDataStr = '';
        if (response.data !== undefined && response.data !== null) {
          if (typeof response.data === 'object') {
            responseDataStr = JSON.stringify(response.data);
          } else {
            responseDataStr = String(response.data);
          }
          if (responseDataStr.length > 200) {
            responseDataStr = responseDataStr.substring(0, 200) + '...';
          }
        }
        
        console.log(`[Request] ${method} ${fullUrl} 响应 ${status}`, responseDataStr || '');
      }

      // 执行自定义成功拦截器
      if (responseInterceptor?.onFulfilled) {
        return responseInterceptor.onFulfilled(response);
      }

      // 默认返回 data
      return returnDataOnly ? response.data : response;
    },
    async (error: AxiosError) => {
      // 记录错误日志（仅在启用时）
      if (REQUEST_LOG_ENABLED) {
        const method = error.config?.method?.toUpperCase() || 'GET';
        const url = error.config?.url || '';
        const fullUrl = error.config?.baseURL ? `${error.config.baseURL}${url}` : url;
        const status = error.response?.status;
        
        const errorInfo: Record<string, unknown> = {
          status: status || 'N/A',
          message: error.message || 'Unknown error'
        };
        
        if (error.response?.data) {
          let errorDataStr = '';
          if (typeof error.response.data === 'object') {
            errorDataStr = JSON.stringify(error.response.data);
          } else {
            errorDataStr = String(error.response.data);
          }
          if (errorDataStr.length > 200) {
            errorDataStr = errorDataStr.substring(0, 200) + '...';
          }
          errorInfo.data = errorDataStr;
        }
        
        console.error(`[Request] ${method} ${fullUrl} 失败:`, errorInfo);
      }

      // 执行自定义错误拦截器
      if (responseInterceptor?.onRejected) {
        return responseInterceptor.onRejected(error);
      }

      // 执行自定义错误处理
      if (errorHandler) {
        await errorHandler(error);
      }

      // 统一错误格式，并对 config 进行脱敏（避免泄露 token/请求体等）
      const sanitizedConfig = (() => {
        if (!error.config) return undefined;
        const {
          url,
          method,
          baseURL,
          timeout,
          responseType,
          withCredentials,
          paramsSerializer
        } = error.config;
        // 仅保留非敏感字段，显式省略 headers/auth/params/data 等
        return {
          url,
          method,
          baseURL,
          timeout,
          responseType,
          withCredentials,
          // paramsSerializer 可能影响调试，但不包含敏感值
          paramsSerializer
        };
      })();

      const errorResponse = {
        message: error.message || "Request failed",
        status: error.response?.status,
        data: error.response?.data,
        config: sanitizedConfig
      };

      return Promise.reject(errorResponse);
    }
  );

  return instance;
}

