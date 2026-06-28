import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClientLayout from "@/components/layout/client-layout";
import Script from "next/script";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#5B8DEF",
};

// basePath 需与 next.config.ts 保持一致
const basePath = process.env.NODE_ENV === "production" ? "/-" : "";

export const metadata: Metadata = {
  title: "时光轴 - 日记分析",
  description: "记录生活，看见时间的形状",
  manifest: `${basePath}/manifest.json`,
  appleWebApp: {
    capable: true,
    title: "时光轴",
    statusBarStyle: "default",
  },
  icons: {
    apple: [
      { url: `${basePath}/icon-192x192.png`, sizes: "192x192", type: "image/png" },
      { url: `${basePath}/icon-512x512.png`, sizes: "512x512", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full bg-bg-main dark:bg-slate-900 text-text-primary dark:text-slate-200 overflow-x-hidden">
        <ClientLayout>{children}</ClientLayout>
        <Script
          id="register-sw"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("${basePath}/sw.js").then(
      function (reg) {
        console.log("📦 SW registered, scope:", reg.scope);
      },
      function (err) {
        console.warn("⚠️ SW registration failed:", err);
      }
    );
  });
}
`,
          }}
        />
      </body>
    </html>
  );
}
