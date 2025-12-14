import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 静的エクスポート設定（Amplifyの静的ホスティング対応）
  output: "export",
  
  // React 19との互換性設定
  reactStrictMode: true,
};

export default nextConfig;
