import { useState, useEffect, useCallback, useRef } from "react";
import { AlertDialog } from "./AlertDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { PromptDialog } from "./PromptDialog";
import "./Modal.css";

// 对话框类型
type DialogType = "alert" | "confirm" | "prompt";

// 对话框配置接口
interface AlertConfig {
  type: "alert";
  message: string;
  title?: string | null;
  okText?: string;
}

interface ConfirmConfig {
  type: "confirm";
  message: string;
  title?: string | null;
  okText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface PromptConfig {
  type: "prompt";
  message: string;
  defaultValue?: string;
  placeholder?: string;
  title?: string | null;
  okText?: string;
  cancelText?: string;
}

type DialogConfig = AlertConfig | ConfirmConfig | PromptConfig;

// 对话框状态
interface DialogState {
  isOpen: boolean;
  config: DialogConfig | null;
  resolve: ((value: any) => void) | null;
}

export function Modal() {
  const [dialogState, setDialogState] = useState<DialogState>({
    isOpen: false,
    config: null,
    resolve: null,
  });

  // 使用 ref 跟踪最新的 dialogState，以便在清理函数中访问最新值
  const dialogStateRef = useRef<DialogState>(dialogState);

  // 当 dialogState 改变时更新 ref
  useEffect(() => {
    dialogStateRef.current = dialogState;
  }, [dialogState]);

  // 创建对话框的通用函数
  const createDialog = useCallback((config: DialogConfig): Promise<any> => {
    return new Promise((resolve) => {
      setDialogState({
        isOpen: true,
        config,
        resolve,
      });
    });
  }, []);

  // 关闭对话框
  const closeDialog = useCallback(() => {
    setDialogState((prev) => {
      if (prev.resolve && prev.config) {
        // 根据类型返回默认值
        if (prev.config.type === "prompt") {
          prev.resolve(null);
        } else if (prev.config.type === "confirm") {
          prev.resolve(false);
        } else {
          prev.resolve(true);
        }
      }
      return {
        isOpen: false,
        config: null,
        resolve: null,
      };
    });
  }, []);

  // 处理确认
  const handleConfirm = useCallback((value?: any) => {
    setDialogState((prev) => {
      if (prev.resolve) {
        if (prev.config?.type === "prompt") {
          prev.resolve(value || "");
        } else {
          prev.resolve(true);
        }
      }
      return {
        isOpen: false,
        config: null,
        resolve: null,
      };
    });
  }, []);

  // 处理取消
  const handleCancel = useCallback(() => {
    setDialogState((prev) => {
      if (prev.resolve) {
        if (prev.config?.type === "prompt") {
          prev.resolve(null);
        } else {
          prev.resolve(false);
        }
      }
      return {
        isOpen: false,
        config: null,
        resolve: null,
      };
    });
  }, []);

  // 暴露全局 API
  useEffect(() => {
    // 获取默认标题（支持国际化）
    const getDefaultTitle = (type: DialogType): string => {
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
      } catch (e) {
        // 忽略错误
      }
      // 降级到默认值
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

    // showAlert 函数
    const showAlert = (message: string, title: string | null = null): Promise<boolean> => {
      return createDialog({
        type: "alert",
        message,
        title: title !== null ? title : getDefaultTitle("alert"),
      });
    };

    // showConfirm 函数
    const showConfirm = (
      message: string,
      title: string | null = null,
      options: { okText?: string; cancelText?: string; danger?: boolean } = {}
    ): Promise<boolean> => {
      return createDialog({
        type: "confirm",
        message,
        title: title !== null ? title : getDefaultTitle("confirm"),
        okText: options.okText,
        cancelText: options.cancelText,
        danger: options.danger || false,
      });
    };

    // showPrompt 函数
    const showPrompt = (
      message: string,
      defaultValue: string = "",
      title: string | null = null
    ): Promise<string | null> => {
      return createDialog({
        type: "prompt",
        message,
        defaultValue,
        title: title !== null ? title : getDefaultTitle("prompt"),
      });
    };

    // 设置全局函数（使用 Object.defineProperty 确保可替换）
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

    // 触发就绪事件
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("modalReady"));
      // 标记 Modal 组件已就绪
      window.__modalReady = true;
    }, 50);

    // 清理函数（注意：不删除全局函数，因为可能被其他代码使用）
    return () => {
      // 组件卸载时，如果有打开的对话框，关闭它
      // 使用 ref 读取最新状态，避免闭包捕获过时的值
      if (dialogStateRef.current.isOpen) {
        closeDialog();
      }
    };
  }, [createDialog, closeDialog]);

  // 渲染对话框
  const renderDialog = () => {
    if (!dialogState.config || !dialogState.isOpen) return null;

    const { config } = dialogState;

    switch (config.type) {
      case "alert":
        return (
          <AlertDialog
            isOpen={dialogState.isOpen}
            onClose={closeDialog}
            title={config.title || undefined}
            message={config.message}
            okText={config.okText}
            onConfirm={() => {
              setDialogState((prev) => {
                if (prev.resolve) {
                  prev.resolve(true);
                }
                return {
                  isOpen: false,
                  config: null,
                  resolve: null,
                };
              });
            }}
          />
        );

      case "confirm":
        return (
          <ConfirmDialog
            isOpen={dialogState.isOpen}
            onClose={closeDialog}
            title={config.title || undefined}
            message={config.message}
            okText={config.okText}
            cancelText={config.cancelText}
            danger={config.danger}
            onConfirm={() => {
              setDialogState((prev) => {
                if (prev.resolve) {
                  prev.resolve(true);
                }
                return {
                  isOpen: false,
                  config: null,
                  resolve: null,
                };
              });
            }}
            onCancel={handleCancel}
          />
        );

      case "prompt":
        return (
          <PromptDialog
            isOpen={dialogState.isOpen}
            onClose={handleCancel}
            title={config.title || undefined}
            message={config.message}
            defaultValue={config.defaultValue}
            placeholder={config.placeholder}
            okText={config.okText}
            cancelText={config.cancelText}
            onConfirm={(value) => {
              setDialogState((prev) => {
                if (prev.resolve) {
                  prev.resolve(value);
                }
                return {
                  isOpen: false,
                  config: null,
                  resolve: null,
                };
              });
            }}
            onCancel={handleCancel}
          />
        );

      default:
        return null;
    }
  };

  return <>{renderDialog()}</>;
}

// 导出默认函数，用于在 HTML 中直接挂载
export default Modal;

