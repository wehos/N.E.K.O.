/**
 * 首页 API 封装模块 - 全局版本（HTML 专用）
 * 
 * 用于在静态 HTML 中独立使用，打包成 request.api.global.js
 * 此版本使用 window.request，专为 HTML 环境设计
 * 
 * 构建后输出：static/bundles/request.api.global.js
 * 
 * 使用方式：
 * ```html
 * <script src="/static/bundles/request.global.js"></script>
 * <script src="/static/bundles/request.api.global.js"></script>
 * <script>
 *   // 使用全局 API（使用 window.request）
 *   window.RequestAPI.getPageConfig().then(config => {
 *     console.log('页面配置:', config);
 *   });
 * </script>
 * ```
 * 
 * 注意：
 * - 此文件仅负责在 HTML/JS 环境中暴露 API
 * - 所有逻辑代码都在 request.api.ts 中
 * - 通过 setRequestInstance 设置使用 window.request
 */

// 导入所有 API 函数和类型
import {
  setRequestInstance,
  getPageConfig,
  getCharacters,
  getLive2DModels,
  findLive2DModelByName,
  sendShutdownBeacon,
  getCurrentCatgirlConfig,
  shouldReloadModel,
  getUserPreferences,
  saveUserPreferences,
  getEmotionMapping,
  unlockSteamAchievement,
  getSteamLanguage,
  setMicrophone,
  getMicrophone,
  analyzeEmotion,
  getCurrentLive2DModel,
  checkAgentHealth,
  checkAgentCapability,
  getAgentFlags,
  setAgentFlags,
  controlAgent,
  getAgentTaskStatus,
  triggerProactiveChat,
  RequestAPI as RequestAPICore,
} from '../request.api';

/**
 * 获取 window.request 实例（HTML 环境专用）
 */
function getWindowRequest(): any {
  if (typeof window === 'undefined') {
    console.warn('[RequestAPI] 非浏览器环境');
    return null;
  }

  if (!window.request) {
    console.warn('[RequestAPI] window.request 未初始化，请确保已加载 request.global.js');
    return null;
  }

  return window.request;
}

/**
 * 初始化全局 API 对象
 * 
 * 将 RequestAPI 命名空间对象暴露到 window.RequestAPI
 * 这样在 HTML 环境中可以使用 window.RequestAPI.getPageConfig() 等方式调用
 */
function initRequestAPI() {
  if (typeof window === 'undefined') {
    console.warn('[RequestAPI] 非浏览器环境，跳过初始化');
    return;
  }

  const windowRequest = getWindowRequest();

  if (!windowRequest) {
    console.warn('[RequestAPI] window.request 未初始化，RequestAPI 可能无法正常工作');
    // 即使没有 request 也暴露 API，函数内部会处理错误
  } else {
    // 设置使用 window.request
    setRequestInstance(windowRequest);
  }

  // 直接暴露整个 RequestAPI 命名空间对象
  window.RequestAPI = RequestAPICore;

  console.log('[RequestAPI] API 命名空间已暴露到全局 window.RequestAPI');
  console.log('[RequestAPI] 可用方法:', Object.keys(RequestAPICore).join(', '));
}

// 自动初始化
if (typeof window !== 'undefined') {
  // 等待 request.global.js 初始化完成后再初始化 RequestAPI
  const waitForRequestAndInit = async () => {
    const maxWait = 5000;
    const startTime = Date.now();
    
    // 等待 window.request 初始化
    while (!window.request && Date.now() - startTime < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    if (window.request) {
      initRequestAPI();
    } else {
      console.warn('[RequestAPI] 等待 request.global.js 初始化超时，RequestAPI 可能无法正常工作');
      // 即使超时也尝试初始化，函数内部会处理错误
      initRequestAPI();
    }
  };

  // 根据 DOM 状态决定何时开始等待
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForRequestAndInit);
  } else {
    // DOM 已加载，直接开始等待
    waitForRequestAndInit();
  }
}

// 导出 RequestAPI 命名空间对象供外部使用（如果需要）
export { RequestAPICore as RequestAPI };
