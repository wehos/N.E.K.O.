/**
 * 首页 API 封装模块（核心逻辑）
 * 
 * 封装首页常用的 API 调用，包含所有业务逻辑
 * 
 * 特性：
 * - 提供类型安全的 API 调用函数
 * - 统一的错误处理
 * - 使用命名空间对象，方便通过关键字搜索（如 "RequestAPI." 或 "requestApi."）
 * - 支持 React 环境和 HTML 环境（通过 setRequestInstance 切换 request 实例）
 * 
 * 注意：
 * - 此模块包含所有业务逻辑代码
 * - React 环境：直接导入并使用，默认使用 React 环境的 request
 * - HTML 环境：通过 request.api.global.ts 使用，会自动设置使用 window.request
 * 
 * 使用方式：
 * 
 * 在 React 组件中（推荐使用命名空间）：
 * ```typescript
 * import { RequestAPI } from '~/api/request.api';
 * 
 * // 使用 API（命名空间方式，方便搜索）
 * const config = await RequestAPI.getPageConfig();
 * const characters = await RequestAPI.getCharacters();
 * ```
 * 
 * 在 React 组件中（也支持直接导入函数）：
 * ```typescript
 * import { getPageConfig, getCharacters } from '~/api/request.api';
 * const config = await getPageConfig();
 * ```
 * 
 * 搜索提示：
 * - 搜索 "RequestAPI." 可以找到所有 API 调用
 * - 搜索 "requestApi" 也可以找到相关代码
 * - 搜索具体功能如 "getPageConfig" 可以找到该 API 的使用位置
 */

// 直接导入 React 环境的 request 模块
import { request as defaultRequest } from './request';

/**
 * Request 实例管理
 * 
 * 默认使用 React 环境的 request 实例
 * 在 HTML 环境中，request.api.global.ts 会通过 setRequestInstance 设置为 window.request
 */
let requestInstance: any = defaultRequest;

/**
 * 设置 request 实例（用于全局环境）
 * 
 * 此函数由 request.api.global.ts 调用，用于在 HTML 环境中使用 window.request
 * React 环境不需要调用此函数，直接使用默认的 request 实例即可
 * 
 * @internal
 */
export function setRequestInstance(instance: any) {
  requestInstance = instance;
}

/**
 * 获取 request 实例
 * 
 * 所有 API 函数都通过此函数获取 request 实例
 * 在 React 环境中返回默认的 request，在 HTML 环境中返回 window.request
 * 
 * @internal
 */
function getRequest(): any {
  return requestInstance;
}

// 类型定义
interface PageConfigResponse {
  success: boolean;
  lanlan_name?: string;
  model_path?: string;
  error?: string;
}

interface CharactersResponse {
  当前猫娘: string;
  猫娘: Record<string, {
    live2d?: string;
    [key: string]: any;
  }>;
  [key: string]: any;
}

interface Live2DModel {
  name: string;
  path: string;
  [key: string]: any;
}

interface BeaconShutdownRequest {
  timestamp: number;
  action: 'shutdown';
}


/**
 * 获取页面配置
 * @param lanlanName - 可选的猫娘名称（从 URL 参数或路径中提取）
 * @returns 页面配置数据
 */
export async function getPageConfig(lanlanName?: string): Promise<PageConfigResponse> {
  try {
    const request = getRequest();
    const apiPath = lanlanName
      ? `/api/config/page_config?lanlan_name=${encodeURIComponent(lanlanName)}`
      : '/api/config/page_config';
    
    const data = await request.get(apiPath) as PageConfigResponse;
    
    if (data && data.success) {
      return data;
    } else {
      throw new Error(data?.error || '获取页面配置失败');
    }
  } catch (error: any) {
    console.error('[getPageConfig] 获取页面配置失败:', error);
    throw error;
  }
}

/**
 * 获取角色配置（包含所有猫娘的完整配置）
 * @returns 角色配置数据
 */
export async function getCharacters(): Promise<CharactersResponse> {
  try {
    const request = getRequest();
    const data = await request.get('/api/characters') as CharactersResponse;
    return data;
  } catch (error: any) {
    console.error('[getCharacters] 获取角色配置失败:', error);
    throw error;
  }
}

/**
 * 获取所有可用的 Live2D 模型列表
 * @returns Live2D 模型列表
 */
export async function getLive2DModels(): Promise<Live2DModel[]> {
  try {
    const request = getRequest();
    const data = await request.get('/api/live2d/models');
    return Array.isArray(data) ? data : [];
  } catch (error: any) {
    console.error('[getLive2DModels] 获取 Live2D 模型列表失败:', error);
    throw error;
  }
}

/**
 * 根据模型名称查找对应的模型路径
 * @param modelName - 模型名称
 * @returns 模型信息（如果找到）
 */
export async function findLive2DModelByName(modelName: string): Promise<Live2DModel | null> {
  try {
    const models = await getLive2DModels();
    const model = models.find(m => m.name === modelName);
    return model || null;
  } catch (error) {
    console.error('[findLive2DModelByName] 查找模型失败:', error);
    return null;
  }
}

/**
 * 发送关闭信号（Beacon）
 * 使用 navigator.sendBeacon 确保在页面关闭时也能发送
 * @param useBeacon - 是否使用 navigator.sendBeacon（默认 true）
 * @returns 是否发送成功
 */
export async function sendShutdownBeacon(useBeacon: boolean = true): Promise<boolean> {
  const payload: BeaconShutdownRequest = {
    timestamp: Date.now(),
    action: 'shutdown',
  };

  try {
    // 优先使用 navigator.sendBeacon（更可靠，即使页面关闭也能发送）
    if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const success = navigator.sendBeacon(
        '/api/beacon/shutdown',
        JSON.stringify(payload)
      );
      
      if (success) {
        console.log('[sendShutdownBeacon] Beacon 信号已发送');
        return true;
      } else {
        console.warn('[sendShutdownBeacon] Beacon 发送失败，尝试使用 request');
      }
    }

    // 备用方案：使用 request.post
    const request = getRequest();
    await request.post('/api/beacon/shutdown', payload);
    console.log('[sendShutdownBeacon] 使用 request 发送关闭信号成功');
    return true;
  } catch (error: any) {
    console.error('[sendShutdownBeacon] 发送关闭信号失败:', error);
    return false;
  }
}

/**
 * 获取当前猫娘的配置
 * @param lanlanName - 猫娘名称（可选，如果不提供则从角色配置中获取当前猫娘）
 * @returns 猫娘配置
 */
export async function getCurrentCatgirlConfig(lanlanName?: string): Promise<{
  name: string;
  live2d?: string;
  [key: string]: any;
} | null> {
  try {
    const characters = await getCharacters();
    
    // 如果没有提供名称，使用当前猫娘
    const targetName = lanlanName || characters['当前猫娘'];
    
    if (!targetName) {
      console.warn('[getCurrentCatgirlConfig] 未找到当前猫娘名称');
      return null;
    }

    const catgirlConfig = characters['猫娘']?.[targetName];
    
    if (!catgirlConfig) {
      console.warn(`[getCurrentCatgirlConfig] 未找到角色 ${targetName} 的配置`);
      return null;
    }

    return {
      name: targetName,
      ...catgirlConfig,
    };
  } catch (error) {
    console.error('[getCurrentCatgirlConfig] 获取猫娘配置失败:', error);
    return null;
  }
}

/**
 * 检查模型是否需要重新加载
 * @param currentModelPath - 当前模型路径
 * @param newModelName - 新模型名称
 * @returns 是否需要重新加载
 */
export async function shouldReloadModel(
  currentModelPath: string,
  newModelName: string
): Promise<boolean> {
  try {
    const modelInfo = await findLive2DModelByName(newModelName);
    
    if (!modelInfo) {
      console.warn(`[shouldReloadModel] 未找到模型 ${newModelName}`);
      return false;
    }

    const newModelPath = modelInfo.path;
    
    // 比较模型路径，判断是否需要重新加载
    if (!currentModelPath) {
      return true; // 当前没有模型，需要加载
    }

    // 提取模型目录名进行比较
    const currentModelDir = currentModelPath.split('/').filter(Boolean).pop() || '';
    const newModelDir = newModelPath.split('/').filter(Boolean).pop() || '';
    
    return !newModelPath.includes(currentModelDir) && currentModelDir !== newModelDir;
  } catch (error) {
    console.error('[shouldReloadModel] 检查模型是否需要重新加载失败:', error);
    return false;
  }
}

/**
 * 获取用户偏好设置
 * @returns 用户偏好列表
 */
export async function getUserPreferences(): Promise<any[]> {
  try {
    const request = getRequest();
    const data = await request.get('/api/preferences') as any[];
    return Array.isArray(data) ? data : [];
  } catch (error: any) {
    console.error('[getUserPreferences] 获取用户偏好失败:', error);
    return [];
  }
}

/**
 * 保存用户偏好设置
 * @param modelPath - 模型路径
 * @param position - 位置信息 { x, y }
 * @param scale - 缩放信息 { x, y }
 * @returns 是否保存成功
 */
export async function saveUserPreferences(
  modelPath: string,
  position: { x: number; y: number },
  scale: { x: number; y: number },
  parameters: Record<string, any>
): Promise<boolean> {
  try {
    // 验证位置和缩放值
    if (!position || typeof position !== 'object' || 
        !Number.isFinite(position.x) || !Number.isFinite(position.y)) {
      console.error('[saveUserPreferences] 位置值无效:', position);
      return false;
    }
    
    if (!scale || typeof scale !== 'object' || 
        !Number.isFinite(scale.x) || !Number.isFinite(scale.y)) {
      console.error('[saveUserPreferences] 缩放值无效:', scale);
      return false;
    }
    
    // 验证缩放值必须为正数
    if (scale.x <= 0 || scale.y <= 0) {
      console.error('[saveUserPreferences] 缩放值必须为正数:', scale);
      return false;
    }

    const preferences = {
      model_path: modelPath,
      position: position,
      scale: scale,
      parameters: {}
    };

    // 如果有参数，添加到偏好中
    if (parameters && typeof parameters === 'object') {
      preferences.parameters = parameters;
    }

    const request = getRequest();
    const result = await request.post('/api/preferences', preferences) as any;
    return result?.success === true;
  } catch (error: any) {
    console.error('[saveUserPreferences] 保存用户偏好失败:', error);
    return false;
  }
}

/**
 * 获取 Live2D 模型的情绪映射配置
 * @param modelName - 模型名称
 * @returns 情绪映射配置，如果失败返回 null
 */
export async function getEmotionMapping(modelName: string): Promise<{
  success: boolean;
  config?: {
    motions?: Record<string, string[]>;
    expressions?: Record<string, string[]>;
  };
} | null> {
  try {
    if (!modelName) {
      console.warn('[getEmotionMapping] 模型名称为空');
      return null;
    }

    const request = getRequest();
    const data = await request.get(`/api/live2d/emotion_mapping/${encodeURIComponent(modelName)}`) as any;
    
    if (data && data.success && data.config) {
      return data;
    } else {
      console.warn('[getEmotionMapping] 获取情绪映射失败:', data);
      return null;
    }
  } catch (error: any) {
    console.error('[getEmotionMapping] 获取情绪映射失败:', error);
    return null;
  }
}

/**
 * 解锁 Steam 成就
 * @param achievementId - 成就ID
 * @returns 是否成功
 */
export async function unlockSteamAchievement(achievementId: string): Promise<boolean> {
  try {
    const request = getRequest();
    const result = await request.post(`/api/steam/set-achievement-status/${achievementId}`, {}) as any;
    return result?.success === true;
  } catch (error: any) {
    console.error('[unlockSteamAchievement] 解锁成就失败:', error);
    return false;
  }
}

/**
 * 保存麦克风选择
 * @param microphoneId - 麦克风设备ID（null 表示使用默认）
 * @returns 是否成功
 */
export async function setMicrophone(microphoneId: string | null): Promise<boolean> {
  try {
    const request = getRequest();
    const result = await request.post('/api/characters/set_microphone', {
      microphone_id: microphoneId
    }) as any;
    return result?.success !== false;
  } catch (error: any) {
    console.error('[setMicrophone] 保存麦克风选择失败:', error);
    return false;
  }
}

/**
 * 获取麦克风选择
 * @returns 麦克风设备ID（null 表示使用默认）
 */
export async function getMicrophone(): Promise<string | null> {
  try {
    const request = getRequest();
    const data = await request.get('/api/characters/get_microphone') as any;
    return data?.microphone_id || null;
  } catch (error: any) {
    console.error('[getMicrophone] 获取麦克风选择失败:', error);
    return null;
  }
}

/**
 * 情感分析
 * @param text - 要分析的文本
 * @param lanlanName - 猫娘名称
 * @returns 情感分析结果
 */
export async function analyzeEmotion(text: string, lanlanName: string): Promise<any | null> {
  try {
    const request = getRequest();
    const data = await request.post('/api/emotion/analysis', {
      text: text,
      lanlan_name: lanlanName
    }) as any;
    
    if (data?.error) {
      console.warn('[analyzeEmotion] 情感分析错误:', data.error);
      return null;
    }
    
    return data;
  } catch (error: any) {
    console.error('[analyzeEmotion] 情感分析失败:', error);
    return null;
  }
}

/**
 * 获取当前猫娘的 Live2D 模型信息
 * @param catgirlName - 猫娘名称
 * @returns 模型信息
 */
export async function getCurrentLive2DModel(catgirlName: string): Promise<any | null> {
  try {
    const request = getRequest();
    const data = await request.get(`/api/characters/current_live2d_model?catgirl_name=${encodeURIComponent(catgirlName)}`) as any;
    return data;
  } catch (error: any) {
    console.error('[getCurrentLive2DModel] 获取当前Live2D模型失败:', error);
    return null;
  }
}

/**
 * Agent 健康检查
 * @returns 是否健康
 */
export async function checkAgentHealth(): Promise<boolean> {
  try {
    const request = getRequest();
    const data = await request.get('/api/agent/health') as any;
    return data?.success === true || data === true;
  } catch (error: any) {
    console.error('[checkAgentHealth] Agent健康检查失败:', error);
    return false;
  }
}

/**
 * 检查 Agent 能力可用性
 * @param capability - 能力类型 ('computer_use' | 'mcp')
 * @returns 是否可用
 */
export async function checkAgentCapability(capability: 'computer_use' | 'mcp'): Promise<boolean> {
  try {
    const apis: Record<string, string> = {
      computer_use: '/api/agent/computer_use/availability',
      mcp: '/api/agent/mcp/availability'
    };
    
    const url = apis[capability];
    if (!url) {
      console.warn('[checkAgentCapability] 未知的能力类型:', capability);
      return false;
    }
    
    const request = getRequest();
    const data = await request.get(url) as any;
    return data?.ready === true;
  } catch (error: any) {
    console.error('[checkAgentCapability] 检查Agent能力失败:', error);
    return false;
  }
}

/**
 * 获取 Agent flags
 * @returns Agent flags 配置
 */
export async function getAgentFlags(): Promise<any | null> {
  try {
    const request = getRequest();
    const data = await request.get('/api/agent/flags') as any;
    if (data?.success) {
      return data;
    }
    return null;
  } catch (error: any) {
    console.error('[getAgentFlags] 获取Agent flags失败:', error);
    return null;
  }
}

/**
 * 设置 Agent flags
 * @param lanlanName - 猫娘名称
 * @param flags - flags 配置对象
 * @returns 是否成功
 */
export async function setAgentFlags(lanlanName: string, flags: Record<string, boolean>): Promise<boolean> {
  try {
    const request = getRequest();
    const result = await request.post('/api/agent/flags', {
      lanlan_name: lanlanName,
      flags: flags
    }) as any;
    return result?.success !== false;
  } catch (error: any) {
    console.error('[setAgentFlags] 设置Agent flags失败:', error);
    return false;
  }
}

/**
 * Agent 控制
 * @param action - 操作类型 ('enable_analyzer' | 'disable_analyzer')
 * @returns 是否成功
 */
export async function controlAgent(action: 'enable_analyzer' | 'disable_analyzer'): Promise<boolean> {
  try {
    const request = getRequest();
    const result = await request.post('/api/agent/admin/control', {
      action: action
    }) as any;
    return result?.success !== false;
  } catch (error: any) {
    console.error('[controlAgent] Agent控制失败:', error);
    return false;
  }
}

/**
 * 获取 Agent 任务状态
 * @returns 任务状态
 */
export async function getAgentTaskStatus(): Promise<any | null> {
  try {
    const request = getRequest();
    const data = await request.get('/api/agent/task_status') as any;
    if (data?.success) {
      return data;
    }
    return null;
  } catch (error: any) {
    console.error('[getAgentTaskStatus] 获取Agent任务状态失败:', error);
    return null;
  }
}

/**
 * 触发主动搭话
 * @param lanlanName - 猫娘名称
 * @returns 主动搭话结果
 */
export async function triggerProactiveChat(lanlanName: string): Promise<any | null> {
  try {
    const request = getRequest();
    const data = await request.post('/api/proactive_chat', {
      lanlan_name: lanlanName
    }) as any;
    return data;
  } catch (error: any) {
    console.error('[triggerProactiveChat] 触发主动搭话失败:', error);
    return null;
  }
}

/**
 * 获取 Steam 语言设置
 * @returns Steam 语言设置数据，失败返回 null
 */
export async function getSteamLanguage(): Promise<{
  success: boolean;
  steam_language?: string;
  i18n_language?: string;
  error?: string;
} | null> {
  try {
    const request = getRequest();
    // 使用 axios 的配置对象传递超时设置
    const data = await request.get('/api/steam_language', {
      timeout: 2000 // 设置超时，避免阻塞太久
    } as any) as any;
    return data;
  } catch (error: any) {
    // 可能是超时或网络错误，静默处理
    console.log('[getSteamLanguage] 无法从 Steam 获取语言设置:', error.message);
    return null;
  }
}

// ============================================
// 命名空间对象导出（推荐使用，方便搜索）
// ============================================

/**
 * 首页 API 命名空间对象
 * 
 * 使用命名空间的好处：
 * 1. 方便搜索：可以通过 "RequestAPI." 快速找到所有 API 调用
 * 2. 避免命名冲突：所有函数都在 RequestAPI 命名空间下
 * 3. 代码组织清晰：相关功能集中在一起
 * 4. 与 HTML 环境一致：window.RequestAPI 使用方式相同
 * 
 * 示例：
 * ```typescript
 * import { RequestAPI } from '~/api/request.api';
 * 
 * // 页面配置相关
 * const config = await RequestAPI.getPageConfig();
 * 
 * // 角色相关
 * const characters = await RequestAPI.getCharacters();
 * const catgirl = await RequestAPI.getCurrentCatgirlConfig();
 * 
 * // Live2D 模型相关
 * const models = await RequestAPI.getLive2DModels();
 * const model = await RequestAPI.findLive2DModelByName('mao_pro');
 * const needReload = await RequestAPI.shouldReloadModel(currentPath, 'mao_pro');
 * 
 * // 系统相关
 * await RequestAPI.sendShutdownBeacon();
 * ```
 */
export const RequestAPI = {
  // 页面配置
  getPageConfig,
  
  // 角色配置
  getCharacters,
  getCurrentCatgirlConfig,
  
  // Live2D 模型
  getLive2DModels,
  findLive2DModelByName,
  shouldReloadModel,
  getEmotionMapping,
  getCurrentLive2DModel,
  
  // 用户偏好
  getUserPreferences,
  saveUserPreferences,
  
  // Steam
  unlockSteamAchievement,
  getSteamLanguage,
  
  // 麦克风
  setMicrophone,
  getMicrophone,
  
  // 情感分析
  analyzeEmotion,
  
  // Agent
  checkAgentHealth,
  checkAgentCapability,
  getAgentFlags,
  setAgentFlags,
  controlAgent,
  getAgentTaskStatus,
  
  // 主动搭话
  triggerProactiveChat,
  
  // 系统功能
  sendShutdownBeacon,
} as const;

// ============================================
// 直接导出函数（向后兼容，也支持直接导入）
// ============================================

// 导出类型
export type {
  PageConfigResponse,
  CharactersResponse,
  Live2DModel,
  BeaconShutdownRequest,
};

