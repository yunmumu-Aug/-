"use client";

import { useEffect, useState } from "react";

type Platform = "android" | "ios" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  if (isIOS) return "ios";
  // Android Chrome
  if (/Android/.test(ua)) return "android";
  return "other";
}

/**
 * PWA 安装提示组件
 *
 * 不依赖 beforeinstallprompt 事件，任何平台都显示安装指引。
 * - Android Chrome: 优先用事件弹窗，失败则显示菜单指引
 * - iOS Safari: 显示 Safari 分享菜单指引
 * - 已安装 / 桌面: 不显示
 */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showMenuGuide, setShowMenuGuide] = useState(false);
  const [platform] = useState(detectPlatform);

  useEffect(() => {
    // 检测是否已安装
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    ) {
      setInstalled(true);
      return;
    }

    // 监听 Chrome 安装事件
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // 已安装 → 隐藏
  if (installed) return null;

  // iOS → 永远显示 Safari 指引
  if (platform === "ios") {
    return (
      <div className="bg-surface dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl shrink-0 mt-0.5">📱</span>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium">安装到主屏幕</h3>
            <ol className="text-xs text-gray-500 dark:text-slate-400 mt-2 space-y-1 list-decimal list-inside leading-relaxed">
              <li>点底部 <b>分享按钮</b> <span className="inline-block text-base align-middle">⎙</span></li>
              <li>向下滑，点 <b>「添加到主屏幕」</b></li>
              <li>点右上角 <b>「添加」</b></li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // 桌面端（非手机）→ 有事件才显示按钮
  if (platform === "other" && !deferredPrompt) return null;

  // Android & 有事件 → 直接安装按钮
  if (deferredPrompt) {
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

  // Android 但事件未触发 → 显示菜单指引 + 重试按钮
  if (platform === "android") {
    return (
      <div className="bg-surface dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl shrink-0 mt-0.5">📲</span>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium">安装时光轴</h3>
            {showMenuGuide ? (
              <ol className="text-xs text-gray-500 dark:text-slate-400 mt-2 space-y-1 list-decimal list-inside leading-relaxed">
                <li>点 Chrome 右上角 <b>⋮</b></li>
                <li>点 <b>「安装应用」</b></li>
              </ol>
            ) : (
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                安装到手机桌面，像原生 App 一样使用
              </p>
            )}
          </div>
          <button
            disabled={installing}
            onClick={async () => {
              if (deferredPrompt) {
                setInstalling(true);
                (deferredPrompt as any).prompt();
                const result = await (deferredPrompt as any).userChoice;
                setInstalling(false);
                if (result.outcome === "accepted") {
                  setInstalled(true);
                  setDeferredPrompt(null);
                  return;
                }
              }
              // 没事件或用户拒绝 → 显示手动指引
              setShowMenuGuide(true);
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

  return null;
}
