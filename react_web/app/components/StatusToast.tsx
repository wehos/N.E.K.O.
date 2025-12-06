import { useState, useEffect, useCallback, useRef } from "react";
import "./StatusToast.css";

interface StatusToastState {
  message: string;
  duration: number;
  isVisible: boolean;
}

export function StatusToast() {
  const [toastState, setToastState] = useState<StatusToastState>({
    message: "",
    duration: 3000,
    isVisible: false,
  });
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const showTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const showToast = useCallback((message: string, duration: number = 3000) => {
    // 清除之前的定时器
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
    
    if (!message || message.trim() === '') {
      // 如果消息为空，隐藏气泡框（完全按照 app.js 的逻辑）
      setToastState(prev => ({
        ...prev,
        isVisible: false,
      }));
      // 延迟清空消息内容（300ms，匹配 app.js）
      setTimeout(() => {
        setToastState(prev => ({
          ...prev,
          message: '',
        }));
      }, 300);
      return;
    }
    
    // 检查元素是否存在（匹配 app.js 的检查逻辑）
    const statusToastElement = containerRef.current || document.getElementById('status-toast');
    if (!statusToastElement) {
      console.error('[Status Toast] statusToast 元素不存在！');
      return;
    }
    
    // 更新内容（先设置消息，但不立即显示）
    setToastState({
      message,
      duration,
      isVisible: false, // 先设置为 false，然后延迟添加 show 类
    });
    
    // 确保元素可见（匹配 app.js 的样式设置）
    // 注意：CSS 中默认是 display: flex，所以这里也设置为 flex
    if (statusToastElement instanceof HTMLElement) {
      statusToastElement.style.display = 'flex';
      statusToastElement.style.visibility = 'visible';
      // 清除内联样式，让 CSS 类完全控制 opacity 和 transform
      statusToastElement.style.removeProperty('opacity');
      statusToastElement.style.removeProperty('transform');
    }
    
    // 移除 hide 类，确保只保留 show 类（匹配 app.js）
    statusToastElement.classList.remove('hide');
    statusToastElement.classList.remove('show'); // 先移除 show，避免重复添加
    
    // 使用 setTimeout 确保样式更新（匹配 app.js 的 10ms 延迟）
    showTimeoutRef.current = setTimeout(() => {
      setToastState(prev => ({
        ...prev,
        isVisible: true,
      }));
      // 确保元素可见
      if (statusToastElement instanceof HTMLElement) {
        statusToastElement.style.display = 'flex';
        statusToastElement.style.visibility = 'visible';
        statusToastElement.style.removeProperty('opacity');
        statusToastElement.style.removeProperty('transform');
      }
      statusToastElement.classList.add('show');
    }, 10);
    
    // 自动隐藏（匹配 app.js 的逻辑）
    timeoutRef.current = setTimeout(() => {
      setToastState(prev => ({
        ...prev,
        isVisible: false,
      }));
      statusToastElement.classList.remove('show');
      statusToastElement.classList.add('hide');
      // 延迟清空消息内容（300ms，匹配 app.js）
      setTimeout(() => {
        setToastState(prev => ({
          ...prev,
          message: '',
        }));
      }, 300);
      timeoutRef.current = null;
    }, duration);
  }, []);

  // 暴露到全局作用域，供 app.js 和其他模块调用
  useEffect(() => {
    // 处理挂载前缓存的消息队列（在设置全局函数之前）
    const messageQueue = window.__statusToastQueue || [];
    const pendingMessages = messageQueue.length > 0 ? [...messageQueue] : [];
    
    // 创建一个包装函数，确保在 React 完全初始化后再调用 showToast
    const wrappedShowToast = (message: string, duration: number = 3000) => {
      // 首先检查公共的 React 就绪信号
      if (window.__REACT_READY) {
        // React 已就绪，直接调用
        showToast(message, duration);
        return;
      }
      
      // React 还未就绪，使用安全的 try/catch 并排队等待
      try {
        showToast(message, duration);
      } catch (e) {
        console.warn('[Status Toast] React 未就绪，消息已加入队列:', e);
        // 将消息加入队列，等待 React 就绪
        if (!window.__statusToastQueue) {
          window.__statusToastQueue = [];
        }
        window.__statusToastQueue.push({ message, duration });
        
        // 监听 react-ready 事件
        const handleReactReady = () => {
          showToast(message, duration);
          window.removeEventListener('react-ready', handleReactReady);
        };
        window.addEventListener('react-ready', handleReactReady, { once: true });
      }
    };
    
    // 设置新的全局函数（React 组件优先）
    // 使用 Object.defineProperty 确保函数可以被正确替换
    Object.defineProperty(window, 'showStatusToast', {
      value: wrappedShowToast,
      writable: true,
      configurable: true,
      enumerable: true
    });
    
    // 处理挂载前缓存的消息队列
    if (pendingMessages.length > 0) {
      // 处理队列中的最后一条消息（只显示最新的，避免重复显示）
      const lastMessage = pendingMessages[pendingMessages.length - 1];
      if (lastMessage) {
        // 延迟一点确保组件完全挂载、ReactDOM 完全初始化，以及 DOM 更新
        // 增加延迟时间，确保 ReactDOM 的 hooks dispatcher 已经初始化
        setTimeout(() => {
          wrappedShowToast(lastMessage.message, lastMessage.duration);
        }, 300); // 增加延迟确保 ReactDOM 完全就绪
      }
      // 清空队列
      window.__statusToastQueue = [];
    }
    
    // 触发就绪事件，通知其他代码组件已准备好
    // 使用 setTimeout 确保事件在下一个事件循环中触发
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('statusToastReady'));
      
      // 检查是否有延迟的消息需要处理（例如 load 事件中的消息）
      // 在就绪事件触发后，再次检查队列，以防有新的消息加入
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
      
      // 监听 load 事件，确保在 load 事件触发时也能处理消息
      // 如果 load 事件还没有触发，添加监听器
      if (document.readyState !== 'complete') {
        window.addEventListener('load', () => {
          // 延迟一点，确保 app.js 中的 load 事件监听器已经执行
          setTimeout(() => {
            const loadQueue = window.__statusToastQueue || [];
            if (loadQueue.length > 0) {
              const lastLoadMessage = loadQueue[loadQueue.length - 1];
              if (lastLoadMessage) {
                wrappedShowToast(lastLoadMessage.message, lastLoadMessage.duration);
                window.__statusToastQueue = [];
              }
            } else {
              // 如果队列为空，可能是 app.js 还没有调用，或者条件不满足
              // 检查 app.js 的调用条件，如果满足则主动显示消息
              if (typeof window.lanlan_config !== 'undefined' && window.lanlan_config?.lanlan_name) {
                const message = window.t 
                  ? window.t('app.started', {name: window.lanlan_config.lanlan_name})
                  : `${window.lanlan_config.lanlan_name}已启动`;
                wrappedShowToast(message, 3000);
              }
            }
          }, 1500); // 延迟 1.5 秒，确保 app.js 的 load 事件监听器（延迟 1 秒）已经执行
        }, { once: true });
      } else {
        // load 事件已经触发，立即检查
        setTimeout(() => {
          const loadQueue = window.__statusToastQueue || [];
          if (loadQueue.length > 0) {
            const lastLoadMessage = loadQueue[loadQueue.length - 1];
            if (lastLoadMessage) {
              wrappedShowToast(lastLoadMessage.message, lastLoadMessage.duration);
              window.__statusToastQueue = [];
            }
          } else {
            // 如果队列为空，检查是否需要主动显示消息
            if (typeof window.lanlan_config !== 'undefined' && window.lanlan_config?.lanlan_name) {
              const message = window.t 
                ? window.t('app.started', {name: window.lanlan_config.lanlan_name})
                : `${window.lanlan_config.lanlan_name}已启动`;
              wrappedShowToast(message, 3000);
            }
          }
        }, 1500);
      }
    }, 50);
    
    // 清理函数
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (showTimeoutRef.current) {
        clearTimeout(showTimeoutRef.current);
      }
      // 注意：不删除全局函数，因为可能被其他代码使用
      // 如果组件卸载，其他代码可能仍然需要这个函数
    };
  }, [showToast]);

  // 同时更新隐藏的 status 元素（保持兼容性，匹配 app.js）
  useEffect(() => {
    const statusElement = document.getElementById('status');
    if (statusElement) {
      statusElement.textContent = toastState.message || '';
    }
  }, [toastState.message]);

  // 初始化容器引用（不强制隐藏，让 toastState 控制显示状态）
  useEffect(() => {
    const container = document.getElementById('status-toast') as HTMLDivElement;
    if (container) {
      containerRef.current = container;
      // 不强制隐藏，让 toastState 和后续的 useEffect 控制显示状态
      // 这样可以确保消息队列中的消息能够正确显示
    }
  }, []);

  // 直接操作容器元素，不创建新的 div（避免重复 id 问题）
  useEffect(() => {
    const container = containerRef.current || document.getElementById('status-toast');
    if (container && container instanceof HTMLElement) {
      // 更新容器的类名和内容
      if (toastState.message) {
        // 移除所有类，然后添加正确的类
        container.className = '';
        container.classList.add(toastState.isVisible ? 'show' : 'hide');
        container.textContent = toastState.message;
        // 确保容器可见（即使 isVisible 为 false，也要显示容器，让 CSS 动画工作）
        container.style.display = 'flex';
        container.style.visibility = 'visible';
        // 清除内联样式，让 CSS 类完全控制 opacity 和 transform
        container.style.removeProperty('opacity');
        container.style.removeProperty('transform');
      } else {
        // 只有在消息为空时才隐藏容器
        // 但不要立即隐藏，让 hide 类的动画完成
        if (!toastState.isVisible) {
          // 延迟隐藏，确保动画完成
          const hideTimeout = setTimeout(() => {
            if (container && !toastState.message) {
              container.className = '';
              container.textContent = '';
              container.style.display = 'none';
              container.style.visibility = 'hidden';
              container.style.removeProperty('opacity');
              container.style.removeProperty('transform');
            }
          }, 300); // 匹配 hide 动画的持续时间
          return () => clearTimeout(hideTimeout);
        }
      }
    }
  }, [toastState.message, toastState.isVisible]);

  // 返回 null，因为我们直接操作 DOM
  return null;
}

// 导出默认函数，用于在 index.html 中直接挂载
export default StatusToast;

