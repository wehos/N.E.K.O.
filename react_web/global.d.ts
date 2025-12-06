// 全局类型声明文件
// 用于声明来自 public/static/ 目录下 JS 文件的全局变量和函数

interface Window {
  // API 相关
  request?: {
    get: <T = any>(url: string, config?: any) => Promise<T>;
    post: <T = any>(url: string, data?: any, config?: any) => Promise<T>;
    put: <T = any>(url: string, data?: any, config?: any) => Promise<T>;
    delete: <T = any>(url: string, config?: any) => Promise<T>;
    patch: <T = any>(url: string, data?: any, config?: any) => Promise<T>;
  };
  buildApiUrl?: (path: string) => string;
  buildWebSocketUrl?: (path: string) => string;
  buildStaticUrl?: (path: string) => string;
  fetchWithBaseUrl?: (url: string, options?: RequestInit) => Promise<Response>;
  API_BASE_URL?: string;
  STATIC_SERVER_URL?: string;
  WEBSOCKET_URL?: string;
  
  // React 初始化工具（通过 react_init.js 暴露）
  ReactInit?: {
    waitForRequestInit: (maxWait?: number) => Promise<void>;
    waitForRequestAPIInit: (maxWait?: number) => Promise<void>;
    checkRequestAvailable: () => void;
  };
  
  // 首页 API 命名空间（通过 request.api.global.js 暴露）
  RequestAPI?: {
    // 页面配置
    getPageConfig: (lanlanName?: string) => Promise<any>;
    // 角色配置
    getCharacters: () => Promise<any>;
    getCurrentCatgirlConfig: (lanlanName?: string) => Promise<any>;
    // Live2D 模型
    getLive2DModels: () => Promise<any[]>;
    findLive2DModelByName: (modelName: string) => Promise<any | null>;
    shouldReloadModel: (currentModelPath: string, newModelName: string) => Promise<boolean>;
    getEmotionMapping: (modelName: string) => Promise<any | null>;
    getCurrentLive2DModel: (catgirlName: string) => Promise<any | null>;
    // 用户偏好
    getUserPreferences: () => Promise<any[]>;
    saveUserPreferences: (modelPath: string, position: { x: number; y: number }, scale: { x: number; y: number }) => Promise<boolean>;
    // Steam 成就
    unlockSteamAchievement: (achievementId: string) => Promise<boolean>;
    // 麦克风
    setMicrophone: (microphoneId: string | null) => Promise<boolean>;
    getMicrophone: () => Promise<string | null>;
    // 情感分析
    analyzeEmotion: (text: string, lanlanName: string) => Promise<any | null>;
    // Agent
    checkAgentHealth: () => Promise<boolean>;
    checkAgentCapability: (capability: 'computer_use' | 'mcp') => Promise<boolean>;
    getAgentFlags: () => Promise<any | null>;
    setAgentFlags: (lanlanName: string, flags: Record<string, boolean>) => Promise<boolean>;
    controlAgent: (action: 'enable_analyzer' | 'disable_analyzer') => Promise<boolean>;
    getAgentTaskStatus: () => Promise<any | null>;
    // 主动搭话
    triggerProactiveChat: (lanlanName: string) => Promise<any | null>;
    // 系统功能
    sendShutdownBeacon: (useBeacon?: boolean) => Promise<boolean>;
  };

  // 配置相关
  lanlan_config?: {
    lanlan_name: string;
  };
  cubism4Model?: string;
  focus_mode?: boolean;
  pageConfigReady?: Promise<boolean>;

  // 菜单跟踪
  activeMenuCount?: number;
  markMenuOpen?: () => void;
  markMenuClosed?: () => void;

  // Live2D 相关
  live2dManager?: {
    getCurrentModel: () => any;
    loadModel: (configOrPath: any, options?: any) => Promise<void>;
    loadUserPreferences: () => Promise<any[]>;
    getEmotionMapping: () => any;
    modelRootPath?: string;
  };
  LanLan1?: {
    live2dModel?: any;
    currentModel?: any;
    emotionMapping?: any;
  };
  PIXI?: any;

  // 应用初始化函数
  showStatusToast?: (message: string, duration?: number) => void;
  
  // React 就绪标志
  __REACT_READY?: boolean;
  
  // StatusToast 消息队列
  __statusToastQueue?: Array<{message: string; duration: number}>;
  
  // Modal 组件就绪标志
  __modalReady?: boolean;
  
  // Modal 对话框全局 API
  showAlert?: (message: string, title?: string | null) => Promise<boolean>;
  showConfirm?: (
    message: string,
    title?: string | null,
    options?: { okText?: string; cancelText?: string; danger?: boolean }
  ) => Promise<boolean>;
  showPrompt?: (
    message: string,
    defaultValue?: string,
    title?: string | null
  ) => Promise<string | null>;
  
  // 静态资源错误处理器（开发环境使用）
  __staticErrorHandlers?: {
    handleError: (event: ErrorEvent) => boolean | void;
    handleResourceError: (event: Event) => boolean | void;
    originalConsoleError: (...args: any[]) => void;
  };
  
  // 国际化函数
  t?: (key: string, params?: Record<string, any>) => string;
}

// 声明全局变量（可以直接访问，不需要 window.）
declare var live2dManager: Window["live2dManager"];
declare var LanLan1: Window["LanLan1"];
declare var PIXI: any;
declare var lanlan_config: Window["lanlan_config"];
declare var cubism4Model: string | undefined;
declare var focus_mode: boolean | undefined;
declare var activeMenuCount: number | undefined;

// 全局函数声明
declare function showStatusToast(message: string, duration?: number): void;

