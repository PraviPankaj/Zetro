/** @type {import('next').NextConfig} */
const backend = (
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000"
).replace(/\/$/, "");

const nextConfig = {
  sassOptions: {
    includePaths: ["node_modules"],
  },
  images: { unoptimized: true },
  // Edge redirect: a prerendered redirect() in app/page.js ships a 307 with no
  // Location header on Vercel, leaving / blank.
  async redirects() {
    return [{ source: "/", destination: "/abc", permanent: false }];
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
      { source: "/media/:path*", destination: `${backend}/media/:path*` },
      { source: "/health", destination: `${backend}/health` },
      { source: "/docs", destination: `${backend}/docs` },
      { source: "/openapi.json", destination: `${backend}/openapi.json` },
    ];
  },
};

export default nextConfig;
