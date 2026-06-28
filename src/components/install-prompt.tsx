"use client";

import { useEffect, useState } from "react";

/**
 * PWA 安装提示组件
 *
 * - Android Chrome: 监听 beforeinstallprompt 事件，用户点按钮后触发安装弹窗
 * - iOS Safari: 无标准 API，显示如何「添加到主屏幕」的指引
 * - 已安装: 不显示任何内容
 */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // 检测是否已安装（display-mode: standalone）
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    ) {
      setInstalled(true);
      return;
    }

    // Android Chrome: 监听安装提示事件
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    // 安装成功
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    // iOS 检测
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as any).MSStream;

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    setShowIOSHelp(isIOS);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // iOS Safari：显示指引
  if (showIOSHelp) {
    return (
      <div className="bg-surface dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl shrink-0 mt-0.5">📱</span>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium">安装到主屏幕</h3>
            <ol className="text-xs text-gray-500 dark:text-slate-400 mt-2 space-y-1 list-decimal list-inside">
              <li>点底部分享按钮 <span className="inline-block text-base">⎙</span></li>
              <li>向下滑，点「添加到主屏幕」</li>
              <li>点右上角「添加」</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // 已安装
  if (installed || !deferredPrompt) return null;

  // 显示安装按钮
  return (
    <div className="bg-surface dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">📲</span>
          <div>
            <h3 className="text-sm font-medium">安装时光轴</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              安装到桌面，像原生 App 一样使用
            </p>
          </div>
        </div>
        <button
          disabled={installing}
          onClick={async () => {
            if (!deferredPrompt) return;
            setInstalling(true);
            (deferredPrompt as any).prompt();
            const result = await (deferredPrompt as any).userChoice;
            setInstalling(false);
            if (result.outcome === "accepted") {
              setInstalled(true);
              setDeferredPrompt(null);
            }
          }}
          className="shrink-0 px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-xl
            hover:bg-blue-600 active:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {installing ? "安装中..." : "安装"}
        </button>
      </div>
    </div>
  );
}
