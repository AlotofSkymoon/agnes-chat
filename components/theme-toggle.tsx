"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  /** 是否显示文字标签 */
  withLabel?: boolean;
}

/**
 * 液态玻璃质感主题切换。
 * 透明度 60% + 背景模糊 + 高光内阴影，保证任何背景下图标都清晰可辨。
 */
export function ThemeToggle({ className, withLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? "切换到浅色模式" : "切换到深色模式"}
      aria-label={isDark ? "切换到浅色模式" : "切换到深色模式"}
      className={cn(
        "glass group relative inline-flex items-center justify-center gap-1.5 overflow-hidden rounded-full transition-all duration-300",
        "hover:scale-105 active:scale-95",
        withLabel ? "h-9 px-3.5 text-xs font-medium" : "h-9 w-9",
        className,
      )}
    >
      {/* 高光 */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full opacity-70"
        style={{
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 100%)",
        }}
      />
      {/* 图标（切换时旋转淡入） */}
      <span className="relative block h-4 w-4">
        <Sun
          className={cn(
            "absolute inset-0 h-4 w-4 transition-all duration-300",
            isDark ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100",
          )}
        />
        <Moon
          className={cn(
            "absolute inset-0 h-4 w-4 transition-all duration-300",
            isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0",
          )}
        />
      </span>
      {withLabel ? (
        <span className="relative text-fg-secondary group-hover:text-fg">
          {isDark ? "浅色" : "深色"}
        </span>
      ) : null}
    </button>
  );
}
