import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClientLayout from "@/components/layout/client-layout";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "时光轴 - 日记分析",
  description: "记录生活，看见时间的形状",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "时光轴",
    statusBarStyle: "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-200 overflow-x-hidden">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
