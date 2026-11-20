import type { NextConfig } from "next";

const API_URL = process.env.API_URL ?? "http://127.0.0.1:5001";

const nextConfig: NextConfig = {
  // Gemini calls can take 30s+; the /api proxy's default 30s timeout would turn them into 500s.
  experimental: { proxyTimeout: 120_000 },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
