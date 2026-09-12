/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Vercel 构建时不再强制要求 eslint / eslint-config-next，避免 "ESLint must be installed" 中断构建
  eslint: {
    ignoreDuringBuilds: true,
  },

  /**
   * 关闭图片优化 + 不允许任何外部图片域名。
   *
   * 背景：@opennextjs/cloudflare < 1.3.0 存在 CVE-2025-6087（SSRF，CVSS 7.8）——
   * /_next/image 端点可被用来代理任意远程地址，攻击者能借你的域名托管内容。
   * 修复版 1.3.0 起要求 Next >= 15.5，本项目停在 Next 14 无法升级，
   * 因此采用官方推荐的替代缓解方案：用 remotePatterns 白名单收紧该端点。
   *
   * 本站不加载任何外部图片（头像/图标均为内联 SVG 或本地文件），
   * 所以置空白名单 + 关闭优化，既消除 SSRF 面，也省掉一层运行时开销。
   */
  images: {
    remotePatterns: [],
    unoptimized: true,
  },
};

export default nextConfig;
