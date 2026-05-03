import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // 僅在本地開發環境 (npm run dev) 啟動代理轉發
    if (process.env.NODE_ENV === "development") {
      return [
        {
          source: "/api/:path*",
          // 將請求暗中轉發給運行在 Port 8000 的 FastAPI
          destination: "http://127.0.0.1:8000/api/:path*",
        },
      ];
    }
    return [];
  },
};

export default nextConfig;