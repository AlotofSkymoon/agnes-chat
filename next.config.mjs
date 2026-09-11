/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Vercel 构建时不再强制要求 eslint / eslint-config-next，避免 "ESLint must be installed" 中断构建
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
