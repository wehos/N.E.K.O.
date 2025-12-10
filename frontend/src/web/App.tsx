import "./styles.css";
import { useCallback, useRef } from "react";
import { Button, StatusToast, Modal } from "@project_neko/components";
import type { StatusToastHandle, ModalHandle } from "@project_neko/components";
import { createRequestClient, WebTokenStorage } from "@project_neko/request";

const trimTrailingSlash = (url?: string) => (url ? url.replace(/\/+$/, "") : "");

const API_BASE = trimTrailingSlash(
  (import.meta as any).env?.VITE_API_BASE_URL ||
    (typeof window !== "undefined" ? (window as any).API_BASE_URL : "") ||
    "http://localhost:48911"
);
const STATIC_BASE = trimTrailingSlash(
  (import.meta as any).env?.VITE_STATIC_SERVER_URL ||
    (typeof window !== "undefined" ? (window as any).STATIC_SERVER_URL : "") ||
    API_BASE
);

// 创建一个简单的请求客户端；若无需鉴权，可忽略 token，默认存储在 localStorage
const request = createRequestClient({
  baseURL: API_BASE,
  storage: new WebTokenStorage(),
  refreshApi: async () => {
    // 示例中不做刷新，实际可按需实现
    throw new Error("refreshApi not implemented");
  },
  returnDataOnly: true
});

function App() {
  const toastRef = useRef<StatusToastHandle | null>(null);
  const modalRef = useRef<ModalHandle | null>(null);

  const handleClick = useCallback(async () => {
    try {
      const data = await request.get("/api/config/page_config", {
        params: { lanlan_name: "test" }
      });
      // 将返回结果展示在控制台或弹窗
      console.log("page_config:", data);
    } catch (err: any) {
      console.error("请求失败", err);
    }
  }, []);

  const handleToast = useCallback(() => {
    toastRef.current?.show("接口调用成功（示例 toast）", 2500);
  }, []);

  const handleAlert = useCallback(async () => {
    await modalRef.current?.alert("这是一条 Alert 弹窗", "提示");
  }, []);

  const handleConfirm = useCallback(async () => {
    const ok =
      (await modalRef.current?.confirm("确认要执行该操作吗？", "确认", {
        okText: "好的",
        cancelText: "再想想",
        danger: false,
      })) ?? false;
    if (ok) {
      toastRef.current?.show("确认已执行", 2000);
    }
  }, []);

  const handlePrompt = useCallback(async () => {
    const name = await modalRef.current?.prompt("请输入昵称：", "Neko");
    if (name) {
      toastRef.current?.show(`你好，${name}!`, 2500);
    }
  }, []);

  return (
    <>
      <StatusToast ref={toastRef} staticBaseUrl={STATIC_BASE} />
      <Modal ref={modalRef} />
      <main className="app">
        <header className="app__header">
          <h1>N.E.K.O 前端主页</h1>
          <p>单页应用，无路由 / 无 SSR</p>
        </header>
        <section className="app__content">
          <div className="card">
            <h2>开始使用</h2>
            <ol>
              <li>在此处挂载你的组件或业务入口。</li>
              <li>如需调用接口，可在 <code>@common</code> 下封装请求。</li>
              <li>构建产物输出到 <code>static/bundles/react_web.js</code>，模板引用即可。</li>
            </ol>
            <div style={{ marginTop: "16px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <Button onClick={handleClick}>请求 page_config</Button>
              <Button variant="secondary" onClick={handleToast}>
                显示 StatusToast
              </Button>
              <Button variant="primary" onClick={handleAlert}>
                Modal Alert
              </Button>
              <Button variant="success" onClick={handleConfirm}>
                Modal Confirm
              </Button>
              <Button variant="danger" onClick={handlePrompt}>
                Modal Prompt
              </Button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

export default App;

