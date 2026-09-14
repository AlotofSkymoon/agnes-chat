import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";

import { DynamicTitle } from "@/components/dynamic-title";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_TITLE,
} from "@/lib/site";
import { ThemeProvider, themeInitScript, useTheme } from "@/components/theme-provider";
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


/**
 * 让 sonner 的 Toast 跟随站点明暗。
 *
 * sonner 的 theme 属性默认是 "light" —— 不显式传的话，
 * 深色模式下弹出的提示条会是白底深字，看着就像"文字没切换过来"。
 */
function ThemeAwareToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      position="top-center"
      richColors
      theme={theme}
      toastOptions={{
        classNames: {
          toast: "rounded-xl border-border/70 backdrop-blur-xl",
        },
      }}
    />
  );
}

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
        </ThemeProvider>
      </body>
    </html>
  );
}
