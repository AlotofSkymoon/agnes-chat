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
   *
   * ✅ 已修复：本项目已升级到 Next 15.5 + @opennextjs/cloudflare ^1.3.0，
   *    该组合正是官方的修复版本，SSRF 面已消除。
   *
   * 这里仍然保留 unoptimized + 空白名单，原因与安全性无关：
   *   1. 本站不加载任何外部图片（头像/图标均为内联 SVG 或本地文件）
   *   2. Workers 免费版有 1 MiB 脚本体积上限，图片优化会增加产物
   * 属于"本来就不需要"而非"为了绕开漏洞"，留着更省资源。
   */
  images: {
    remotePatterns: [],
    unoptimized: true,
  },
};

export default nextConfig;
