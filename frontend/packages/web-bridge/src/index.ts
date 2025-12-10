import type { ModalHandle, StatusToastHandle } from "@project_neko/components";
import type { RequestClientConfig, TokenStorage } from "@project_neko/request";
import { createRequestClient } from "@project_neko/request";
import { WebTokenStorage } from "@project_neko/request";
import type { AxiosInstance } from "axios";
import "./global";

type Cleanup = () => void;

const isAbsoluteUrl = (url: string): boolean =>
  /^(?:https?:|wss?:)?\/\//.test(url);

const trimTrailingSlash = (url?: string): string =>
  url ? url.replace(/\/+$/, "") : "";

const ensureLeadingSlash = (path: string): string =>
  path.startsWith("/") ? path : `/${path}`;

const readEnv = (key: string): string | undefined => {
  try {
    // 兼容 Vite/ESM 环境
    return (import.meta as any)?.env?.[key];
  } catch (_e) {
    return undefined;
  }
};

const defaultApiBase = (): string =>
  window.API_BASE_URL ||
  readEnv("VITE_API_BASE_URL") ||
  "http://localhost:48911";

const defaultStaticBase = (apiBase: string): string =>
  window.STATIC_SERVER_URL || readEnv("VITE_STATIC_SERVER_URL") || apiBase;

const defaultWebSocketBase = (apiBase: string): string =>
  window.WEBSOCKET_URL || readEnv("VITE_WEBSOCKET_URL") || apiBase;

const buildHttpUrl = (base: string, path: string): string => {
  if (isAbsoluteUrl(path)) return path;
  const cleanBase = trimTrailingSlash(base);
  const cleanPath = ensureLeadingSlash(path);
  return `${cleanBase}${cleanPath}`;
};

const toWebSocketUrl = (url: string): string =>
  url
    .replace(/^http:\/\//i, "ws://")
    .replace(/^https:\/\//i, "wss://");

export interface RequestWindowOptions {
  apiBaseUrl?: string;
  staticServerUrl?: string;
  websocketUrl?: string;
}

export function resolveLanlanNameFromLocation(): string {
  // 优先 URL 参数
  const urlParams = new URLSearchParams(window.location.search);
  let lanlanNameFromUrl = urlParams.get("lanlan_name") || "";

  // 再从路径提取 /{lanlan_name}
  if (!lanlanNameFromUrl) {
    const pathParts = window.location.pathname.split("/").filter(Boolean);
    if (pathParts.length > 0 && !["focus", "api", "static", "templates"].includes(pathParts[0])) {
      lanlanNameFromUrl = decodeURIComponent(pathParts[0]);
    }
  }

  return lanlanNameFromUrl;
}

export function bindStatusToastToWindow(handle: StatusToastHandle): Cleanup {
  if (typeof window === "undefined") {
    return () => {};
  }

  let reactReadyListenerAttached = false;

  const pendingMessages =
    window.__statusToastQueue && window.__statusToastQueue.length > 0
      ? [...window.__statusToastQueue]
      : [];

  const wrappedShowToast = (message: string, duration: number = 3000) => {
    if (!message || message.trim() === "") {
      return;
    }

    if (window.__REACT_READY) {
      handle.show(message, duration);
      return;
    }

    if (!window.__statusToastQueue) {
      window.__statusToastQueue = [];
    }
    window.__statusToastQueue.push({ message, duration });

    if (!reactReadyListenerAttached) {
      const handleReactReady = () => {
        const queue = window.__statusToastQueue || [];
        queue.forEach((item) => handle.show(item.message, item.duration));
        window.__statusToastQueue = [];
        reactReadyListenerAttached = false;
      };
      window.addEventListener("react-ready", handleReactReady, { once: true });
      reactReadyListenerAttached = true;
    }
  };

  Object.defineProperty(window, "showStatusToast", {
    value: wrappedShowToast,
    writable: true,
    configurable: true,
    enumerable: true,
  });

  if (pendingMessages.length > 0) {
    const lastMessage = pendingMessages[pendingMessages.length - 1];
    if (lastMessage) {
      setTimeout(() => {
        wrappedShowToast(lastMessage.message, lastMessage.duration);
      }, 300);
    }
    window.__statusToastQueue = [];
  }

  const handleLoad = () => {
    setTimeout(() => {
      const loadQueue = window.__statusToastQueue || [];
      if (loadQueue.length > 0) {
        const lastLoadMessage = loadQueue[loadQueue.length - 1];
        if (lastLoadMessage) {
          wrappedShowToast(lastLoadMessage.message, lastLoadMessage.duration);
          window.__statusToastQueue = [];
        }
      } else if (typeof window.lanlan_config !== "undefined" && window.lanlan_config?.lanlan_name) {
        const message =
          window.t?.("app.started", { name: window.lanlan_config.lanlan_name }) ??
          `${window.lanlan_config.lanlan_name}已启动`;
        wrappedShowToast(message, 3000);
      }
    }, 1500);
  };

  const loadAttached = document.readyState !== "complete";
  if (loadAttached) {
    window.addEventListener("load", handleLoad, { once: true });
  } else {
    handleLoad();
  }

  const readyTimer = setTimeout(() => {
    window.dispatchEvent(new CustomEvent("statusToastReady"));

    setTimeout(() => {
      const delayedQueue = window.__statusToastQueue || [];
      if (delayedQueue.length > 0) {
        const lastDelayedMessage = delayedQueue[delayedQueue.length - 1];
        if (lastDelayedMessage) {
          wrappedShowToast(lastDelayedMessage.message, lastDelayedMessage.duration);
          window.__statusToastQueue = [];
        }
      }
    }, 100);
  }, 50);

  return () => {
    clearTimeout(readyTimer);
    if (loadAttached) {
      window.removeEventListener("load", handleLoad);
    }
  };
}

export function bindModalToWindow(handle: ModalHandle): Cleanup {
  if (typeof window === "undefined") {
    return () => {};
  }

  const getDefaultTitle = (type: "alert" | "confirm" | "prompt"): string => {
    try {
      if (window.t && typeof window.t === "function") {
        switch (type) {
          case "alert":
            return window.t("common.alert");
          case "confirm":
            return window.t("common.confirm");
          case "prompt":
            return window.t("common.input");
          default:
            return "提示";
        }
      }
    } catch (_e) {
      // ignore i18n errors
    }
    switch (type) {
      case "alert":
        return "提示";
      case "confirm":
        return "确认";
      case "prompt":
        return "输入";
      default:
        return "提示";
    }
  };

  const showAlert = (message: string, title: string | null = null): Promise<boolean> => {
    return handle.alert(message, title !== null ? title : getDefaultTitle("alert"));
  };

  const showConfirm = (
    message: string,
    title: string | null = null,
    options: { okText?: string; cancelText?: string; danger?: boolean } = {}
  ): Promise<boolean> => {
    return handle.confirm(message, title !== null ? title : getDefaultTitle("confirm"), options);
  };

  const showPrompt = (
    message: string,
    defaultValue: string = "",
    title: string | null = null
  ): Promise<string | null> => {
    return handle.prompt(message, defaultValue, title !== null ? title : getDefaultTitle("prompt"));
  };

  Object.defineProperty(window, "showAlert", {
    value: showAlert,
    writable: true,
    configurable: true,
    enumerable: true,
  });

  Object.defineProperty(window, "showConfirm", {
    value: showConfirm,
    writable: true,
    configurable: true,
    enumerable: true,
  });

  Object.defineProperty(window, "showPrompt", {
    value: showPrompt,
    writable: true,
    configurable: true,
    enumerable: true,
  });

  const readyTimer = setTimeout(() => {
    window.dispatchEvent(new CustomEvent("modalReady"));
    window.__modalReady = true;
  }, 50);

  return () => {
    clearTimeout(readyTimer);
  };
}

export function bindComponentsToWindow(handles: {
  toast?: StatusToastHandle | null;
  modal?: ModalHandle | null;
}): Cleanup {
  const cleanups: Cleanup[] = [];
  if (handles.toast) {
    cleanups.push(bindStatusToastToWindow(handles.toast));
  }
  if (handles.modal) {
    cleanups.push(bindModalToWindow(handles.modal));
  }

  return () => {
    cleanups.forEach((fn) => fn && fn());
  };
}

export function bindRequestToWindow(client: AxiosInstance, options: RequestWindowOptions = {}): Cleanup {
  if (typeof window === "undefined") {
    return () => {};
  }

  const apiBase = trimTrailingSlash(options.apiBaseUrl || defaultApiBase());
  const staticBase = trimTrailingSlash(options.staticServerUrl || defaultStaticBase(apiBase));
  const websocketBase = trimTrailingSlash(options.websocketUrl || defaultWebSocketBase(apiBase));

  const buildApiUrl = (path: string) => buildHttpUrl(apiBase, path);
  const buildStaticUrl = (path: string) => buildHttpUrl(staticBase || apiBase, path);
  const buildWebSocketUrl = (path: string) => {
    if (isAbsoluteUrl(path)) {
      return toWebSocketUrl(path);
    }
    const httpUrl = buildHttpUrl(websocketBase || apiBase, path);
    return toWebSocketUrl(httpUrl);
  };

  const fetchWithBaseUrl = (path: string, init?: RequestInit) =>
    fetch(buildApiUrl(path), init);

  Object.defineProperty(window, "request", {
    value: client,
    writable: true,
    configurable: true,
    enumerable: true,
  });
  window.API_BASE_URL = apiBase;
  window.STATIC_SERVER_URL = staticBase;
  window.WEBSOCKET_URL = websocketBase;
  window.buildApiUrl = buildApiUrl;
  window.buildStaticUrl = buildStaticUrl;
  window.buildWebSocketUrl = buildWebSocketUrl;
  window.fetchWithBaseUrl = fetchWithBaseUrl;

  const readyTimer = setTimeout(() => {
    window.dispatchEvent(new CustomEvent("requestReady"));
  }, 0);

  return () => {
    clearTimeout(readyTimer);
  };
}

export interface CreateAndBindRequestOptions
  extends Partial<RequestClientConfig>,
    RequestWindowOptions {
  storage?: TokenStorage;
}

export function createAndBindRequest(
  options: CreateAndBindRequestOptions = {}
): { client: AxiosInstance; cleanup: Cleanup } {
  const apiBaseUrl = options.apiBaseUrl || options.baseURL || defaultApiBase();
  const storage = options.storage || new WebTokenStorage();
  const refreshApi =
    options.refreshApi ||
    (async () => {
      throw new Error("refreshApi not implemented");
    });

  const client = createRequestClient({
    ...options,
    baseURL: apiBaseUrl,
    storage,
    refreshApi,
  });

  const cleanup = bindRequestToWindow(client, {
    apiBaseUrl,
    staticServerUrl: options.staticServerUrl,
    websocketUrl: options.websocketUrl,
  });

  return { client, cleanup };
}

export function createDefaultRequestClient(
  options: Partial<CreateAndBindRequestOptions> = {}
): AxiosInstance {
  const apiBaseUrl = options.apiBaseUrl || options.baseURL || defaultApiBase();
  const storage = options.storage || new WebTokenStorage();
  const refreshApi =
    options.refreshApi ||
    (async () => {
      throw new Error("refreshApi not implemented");
    });

  return createRequestClient({
    ...options,
    baseURL: apiBaseUrl,
    storage,
    refreshApi,
  });
}

export function bindDefaultRequestToWindow(
  options: CreateAndBindRequestOptions = {}
): { client: AxiosInstance; cleanup: Cleanup } {
  const client = createDefaultRequestClient(options);
  const cleanup = bindRequestToWindow(client, {
    apiBaseUrl: options.apiBaseUrl,
    staticServerUrl: options.staticServerUrl,
    websocketUrl: options.websocketUrl,
  });
  return { client, cleanup };
}

// 在加载 web-bridge UMD 时自动将默认 request 绑定到 window.request（若尚未绑定）
export function autoBindDefaultRequest(): AxiosInstance | null {
  if (typeof window === "undefined") return null;
  if (window.__nekoBridgeRequestBound && window.request) {
    return window.request;
  }
  const { client } = bindDefaultRequestToWindow();
  window.__nekoBridgeRequestBound = true;
  return client;
}

// 立即执行一次自动绑定，确保页面引入 web-bridge 后即可使用 window.request
if (typeof window !== "undefined") {
  autoBindDefaultRequest();
}

