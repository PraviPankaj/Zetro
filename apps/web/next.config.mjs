/** @type {import('next').NextConfig} */
const nextConfig = {
  sassOptions: {
    includePaths: ["node_modules"],
  },
  images: { unoptimized: true },
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    return [{ source: "/media/:path*", destination: `${api}/media/:path*` }];
  },
};

export default nextConfig;
