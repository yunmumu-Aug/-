/**
 * Service Worker — 时光轴 PWA
 *
 * 自包含，无外部 CDN 依赖。预缓存清单由构建脚本注入。
 * 不使用 workbox，纯原生 Cache + Fetch API。
 */
self.__WB_MANIFEST = [];

// ========== 安装：预缓存所有静态资源 ==========

const PRECACHE = "precache-v1";
const RUNTIME = "runtime-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(self.__WB_MANIFEST))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  const validCaches = [PRECACHE, RUNTIME];
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.map((key) => (validCaches.includes(key) ? null : caches.delete(key))))
      )
      .then(() => self.clients.claim())
  );
});

// ========== 请求拦截 ==========

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 仅处理同源请求
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;

  // 1. Supabase API → 仅网络
  if (path.includes("supabase")) {
    return;
  }

  // 2. _next/static → 缓存优先（带 hash，永不更新）
  if (path.includes("/_next/static/")) {
    event.respondWith(cacheFirst(request, PRECACHE));
    return;
  }

  // 3. 静态资源（图片、字体等）→ 缓存优先
  if (/\.(png|jpg|jpeg|svg|gif|ico|woff2?|eot|ttf|otf)$/i.test(path)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 4. manifest.json → 缓存优先
  if (path.endsWith("/manifest.json")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 5. HTML 导航 → 缓存优先（有缓存展示缓存，否则网络获取）
  if (request.mode === "navigate") {
    event.respondWith(navigateHandler(request));
    return;
  }
});

// ========== 缓存策略 ==========

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503 });
  }
}

async function navigateHandler(request) {
  // 先看预缓存
  const cached = await caches.match(request);
  if (cached) return cached;

  // 再看运行时缓存
  const runtimeCached = await caches.match(request, { cacheName: RUNTIME });
  if (runtimeCached) return runtimeCached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // 离线 fallback → 返回缓存的首页
    const fallback = await caches.match("/-/");
    if (fallback) return fallback;
    return new Response("Offline", { status: 503 });
  }
}
