// ReactDOM Client bundle entry point
// This file re-exports createRoot and other client APIs from react-dom/client
// 重要：必须先导入 React，这样 ReactDOM 可以访问 React 的 __CLIENT_INTERNALS
import "react";
export * from "react-dom/client";
// 确保 createRoot 被导出
export { createRoot } from "react-dom/client";
// 导出 createPortal（用于 Portal 功能）
export { createPortal } from "react-dom";

