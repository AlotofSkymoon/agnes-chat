"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * 跟随鼠标的高光卡片。
 *
 * 两道光：
 * - 一道大范围柔光跟着指针走（"glare"）
 * - 一道沿卡片边缘的细亮线，指针靠近时才明显
 *
 * 用 CSS 变量传坐标而不是 state —— 鼠标移动每秒几十次，
 * 走 state 会触发同样次数的 React 重渲染，纯 CSS 变量则由合成器处理，不掉帧。
 *
 * 触屏没有 pointer 移动事件，直接不显示高光（进度保持 0），不会出现卡住的亮点。
 */

export function GlareCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  /** 0 → 1 的淡入进度，首次进入时渐显，避免高光"啪"地出现 */
  const [active, setActive] = React.useState(false);

  function move(e: React.PointerEvent<HTMLDivElement>) {
    // 触屏的 pointermove 多为辅助指针，忽略
    if (e.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }

  return (
    <div
      ref={ref}
      onPointerMove={move}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => setActive(false)}
      className={cn(
        "group/glare relative isolate overflow-hidden rounded-3xl",
        "border border-white/15 bg-black/40 backdrop-blur-sm",
        "shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]",
        className,
      )}
      style={{ ["--mx" as string]: "50%", ["--my" as string]: "50%" }}
    >
      {/* 柔光 */}
      <div
        className={cn(
          "pointer-events-none absolute -inset-px -z-10 transition-opacity duration-300",
          active ? "opacity-100" : "opacity-0",
        )}
        style={{
          background:
            "radial-gradient(420px circle at var(--mx) var(--my), rgba(196,181,253,0.35), transparent 62%)",
        }}
      />
      {/* 边缘细亮线 */}
      <div
        className={cn(
          "pointer-events-none absolute -inset-px -z-10 rounded-3xl transition-opacity duration-300",
          active ? "opacity-100" : "opacity-0",
        )}
        style={{
          background:
            "radial-gradient(320px circle at var(--mx) var(--my), rgba(255,255,255,0.5), transparent 40%)",
          // 用 mask 只保留 1px 边框，内部掏空
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          padding: "1px",
        }}
      />
      <div className="relative z-10 flex h-full w-full flex-col">{children}</div>
    </div>
  );
}
