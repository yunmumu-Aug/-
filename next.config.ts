import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 允许 Supabase 的图片域名
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
};

export default nextConfig;
