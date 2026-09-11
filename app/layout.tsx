import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";

import { ThemeProvider, themeInitScript } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agnes AI 免费聊天",
  description: "极简、免费的 Agnes AI 网页聊天 —— 仅聊天，无 Agent 功能。",
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
      </head>
      <body className="font-sans">
        <ThemeProvider>
          {children}
          <Toaster
            position="top-center"
            richColors
            toastOptions={{
              classNames: {
                toast: "rounded-xl border-border/70 backdrop-blur-xl",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
