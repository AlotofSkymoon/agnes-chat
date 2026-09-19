import type { Metadata, Viewport } from "next";

import { DynamicTitle } from "@/components/dynamic-title";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_TITLE,
} from "@/lib/site";
import { IpGuardGate } from "@/components/ip-guard-gate";
import { ThemeAwareToaster } from "@/components/theme-aware-toaster";
import { ThemeProvider, themeInitScript } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: SITE_TITLE,
  applicationName: SITE_NAME,
  description: SITE_DESCRIPTION,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
    shortcut: [{ url: "/favicon.ico" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#4D6BFE",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* 拉丁字形是首屏必需的（SF Pro），优先预加载；中日韩部分按需加载 */}
        <link
          rel="preload"
          href="/fonts/Montserrat-400.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="font-sans">
        <ThemeProvider>
          <DynamicTitle />
          {children}
          {/*
            theme 跟随站点明暗：sonner 默认 theme="light"，
            不传的话深色模式下弹出提示会是白底深字的一块亮斑。
            这里由 ThemeAwareToaster 读取当前 theme 再传给 Toaster。
          */}
          <ThemeAwareToaster />
          {/*
            代理访问拦截：检测由客户端发起（/api/ip-guard），
            放在这里保证全站生效。未配置 IPIP_RISK_TOKEN 时接口返回
            detected=false，组件不渲染，等于自动关闭。
          */}
          <IpGuardGate />
        </ThemeProvider>
      </body>
    </html>
  );
}
