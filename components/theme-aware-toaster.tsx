"use client";

import { Toaster } from "sonner";

import { useTheme } from "@/components/theme-provider";

/**
 * 跟随明暗模式的 Toast 容器。
 *
 * ⚠️ 必须单独成文件并标记 "use client" ——
 * 之前它定义在 app/layout.tsx 里，而 layout 是服务端组件（要导出 metadata，
 * 不能加 "use client"）。服务端渲染时调用 useTheme() 会直接抛错：
 *   "Attempted to call useTheme() from the server but useTheme is on the client"
 * 构建预渲染 /_not-found 时就崩在这里。
 */
export function ThemeAwareToaster() {
  /*
   * 必须用 resolvedTheme 而不是 theme ——
   * theme 可能是 "system"，sonner 不认识这个值会退回 light，
   * 深色模式下提示条又变成白底深字了。
   */
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      position="top-center"
      richColors
      theme={resolvedTheme}
      toastOptions={{
        classNames: {
          toast: "rounded-xl border-border/70 backdrop-blur-xl",
        },
      }}
    />
  );
}
