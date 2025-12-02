import threading
import tkinter as tk
from plugin.decorators import neko_plugin  # 使用绝对导入，避免相对导入上下文问题

@neko_plugin
class TkWindowPlugin:
    def __init__(self):
        self._started = False
        self._thread = None

    def _run_tk(self, title: str, message: str):
        root = tk.Tk()
        root.title(title)
        label = tk.Label(root, text=message, padx=20, pady=20)
        label.pack()
        btn = tk.Button(root, text="Close", command=root.destroy)
        btn.pack()
        root.mainloop()

    def run(self, title: str | None = None, message: str | None = None, **_):
        if self._started:
            return {"started": False, "reason": "window already running"}

        self._started = True
        t = threading.Thread(
            target=self._run_tk,
            args=(title or "N.E.K.O Tk Plugin", message or "Hello from Tk plugin!"),
            daemon=True,  # 守护线程，进程退出时自动结束
        )
        t.start()
        self._thread = t
        return {"started": True, "info": "Tk window thread started"}
