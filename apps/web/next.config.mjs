/** @type {import('next').NextConfig} */
const nextConfig = {
  sassOptions: {
    includePaths: ["node_modules"],
  },
  images: { unoptimized: true },
  async rewrites() {
    // Browser hits same origin; Next proxies API/media to local FastAPI (Docker / start-all).
    const api = process.env.API_INTERNAL_URL || "http://127.0.0.1:8000";
    return [
      { source: "/api/:path*", destination: `${api}/api/:path*` },
      { source: "/media/:path*", destination: `${api}/media/:path*` },
      { source: "/health", destination: `${api}/health` },
      { source: "/docs", destination: `${api}/docs` },
      { source: "/openapi.json", destination: `${api}/openapi.json` },
    ];
  },
};

export default nextConfig;
