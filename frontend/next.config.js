/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  experimental: { optimizePackageImports: ["lucide-react"] },
  async rewrites() {
    return [
      { source: "/gw/:path*", destination: `${process.env.GATEWAY_URL || "http://localhost:8000"}/:path*` },
    ];
  },
};
module.exports = nextConfig;
