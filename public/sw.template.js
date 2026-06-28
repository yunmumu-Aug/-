/**
 * Service Worker - 时光轴 PWA
 *
 * 使用 Workbox 构建的离线优先 Service Worker。
 * - precache: 由 workbox-build 注入静态资源清单（通过 __WB_MANIFEST）
 * - stale-while-revalidate: 导航请求（HTML 页面）
 * - cache-first: _next/static 等带 hash 的资源
 * - network-only: Supabase API 请求
 *
 * 注意：此文件是模板，__WB_MANIFEST 在构建时由 build-sw.mjs 替换为实际文件列表。
 */

importScripts(
  "https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js"
);

workbox.setConfig({ debug: false });

const { precacheAndRoute, cleanupOutdatedCaches } = workbox.precaching;
const { registerRoute, setDefaultHandler, NavigationRoute } = workbox.routing;
const {
  StaleWhileRevalidate,
  CacheFirst,
  NetworkFirst,
  NetworkOnly,
} = workbox.strategies;
const { CacheableResponsePlugin } = workbox.cacheableResponse;
const { ExpirationPlugin } = workbox.expiration;
const { skipWaiting, clientsClaim } = workbox.core;

// ========== 安装与激活 ==========

skipWaiting();
clientsClaim();

// ========== 预缓存（注入清单在构建时生成） ==========

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ========== 运行时缓存策略 ==========

// 1. 带 hash 的静态资源（JS/CSS/图片）：缓存优先
registerRoute(
  /\/_next\/static\/.+/,
  new CacheFirst({
    cacheName: "next-static",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 天
      }),
    ],
  })
);

// 2. 字体和图标文件：缓存优先
registerRoute(
  /\.(?:png|jpg|jpeg|svg|gif|ico|woff2?|eot|ttf|otf)$/,
  new CacheFirst({
    cacheName: "assets",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  })
);

// 3. manifest.json 和静态路由资源：缓存优先
registerRoute(
  /\.(?:json)$/,
  new CacheFirst({
    cacheName: "static-json",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 24 * 60 * 60, // 1 天
      }),
    ],
  })
);

// 4. Supabase API 请求（含认证）：网络优先
registerRoute(
  /.*supabase\.co\/rest\/.*/,
  new NetworkFirst({
    cacheName: "supabase-api",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 5 * 60, // 5 分钟
      }),
    ],
  })
);

// 5. Supabase Auth 请求：仅网络（不过期不过期）
registerRoute(/.*supabase\.co\/auth\/.*/, new NetworkOnly());

// 6. 导航请求（HTML 页面）：StaleWhileRevalidate 保证快速加载
//    优先展示缓存内容，后台更新缓存
const navigationHandler = new StaleWhileRevalidate({
  cacheName: "pages",
  plugins: [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
  ],
});

const navigationRoute = new NavigationRoute(navigationHandler);
registerRoute(navigationRoute);

// ========== 离线回退 ==========

// 如果导航请求失败（离线），返回缓存的首页
self.addEventListener("fetch", (event) => {
  if (
    event.request.mode === "navigate" &&
    !navigator.onLine
  ) {
    event.respondWith(
      caches.match("/").then((cached) => cached || fetch(event.request))
    );
  }
});
