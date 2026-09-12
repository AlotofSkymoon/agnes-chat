"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Aceternity UI 风格效果组件（纯 CSS + 少量 JS 实现）。
 *
 * 为什么不用官方版本：
 *   官方组件依赖 framer-motion（约 50KB gzip）。本项目要部署到
 *   Cloudflare Workers，免费版脚本上限 1 MiB，多一个大依赖很奢侈。
 *   而 Aceternity 的视觉效果本质上是 CSS 渐变 + 变换，
 *   用原生实现能拿到 95% 的观感，体积几乎为零。
 *
 * 动画全部走 CSS，JS 只负责写入鼠标位置相关的 CSS 变量。
 */

/* ------------------------------ Spotlight ------------------------------ */

/**
 * 聚光灯卡片：鼠标在卡片上移动时，光斑和亮边跟随。
 *
 * 实现方式：mousemove 时把相对坐标写成 CSS 变量，
 * 具体渲染交给 CSS（见 .acet-spotlight）。JS 只做一次赋值，不触发重渲染。
 */
export function SpotlightCard({
  children,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}) {
  const ref = React.useRef<HTMLElement>(null);

  const onMove = React.useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // 直接改 style，不走 React state —— 避免每次移动都重渲染
    el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement>}
      onMouseMove={onMove}
      className={cn("acet-spotlight", className)}
    >
      {children}
    </Tag>
  );
}

/* -------------------------------- Tilt -------------------------------- */

/**
 * 3D 倾斜卡片：跟随鼠标做轻微的 3D 旋转，离开时缓慢回正。
 * 倾斜幅度刻意做小（±6°），超过就容易显得廉价。
 */
export function TiltCard({
  children,
  className,
  max = 6,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  const onMove = React.useCallback(
    (e: React.MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      // 归一化到 [-0.5, 0.5]，再映射到倾斜角度
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--ry", `${px * max * 2}deg`);
      el.style.setProperty("--rx", `${-py * max * 2}deg`);
    },
    [max],
  );

  const reset = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      className={cn("acet-tilt", className)}
    >
      {children}
    </div>
  );
}

/* ---------------------------- Glow Border ---------------------------- */

/** 旋转渐变边框：hover 时沿边缘转一圈流光 */
export function GlowBorder({
  children,
  className,
  active = false,
}: {
  children?: React.ReactNode;
  className?: string;
  /** 常亮（不只在 hover 时显示） */
  active?: boolean;
}) {
  return (
    <div
      className={cn("acet-glow-border", active && "[&::before]:opacity-100", className)}
    >
      {children}
    </div>
  );
}

/* ------------------------------ Beams ------------------------------- */

/**
 * 光束背景：从顶部落下的细光柱。
 * 用 useMemo 固定随机参数，避免每次渲染都变化导致布局跳动。
 */
export function Beams({ count = 12, className }: { count?: number; className?: string }) {
  const beams = React.useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: `${(i / count) * 100 + Math.random() * 6}%`,
        delay: `${Math.random() * 6}s`,
        duration: `${6 + Math.random() * 6}s`,
      })),
    [count],
  );

  return (
    <div className={cn("acet-beams", className)} aria-hidden>
      {beams.map((b, i) => (
        <i
          key={i}
          style={{
            left: b.left,
            animationDelay: b.delay,
            animationDuration: b.duration,
          }}
        />
      ))}
    </div>
  );
}

/* --------------------------- Aurora Background --------------------------- */

/** 极光背景容器：把子元素包在缓慢漂移的彩色光晕之上 */
export function AuroraBackground({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("aurora", className)}>
      {children}
    </div>
  );
}

/* ------------------------------ Grid ------------------------------- */

/** 网格背景：中心清晰、四周淡出 */
export function GridBackground({ className }: { className?: string }) {
  return <div className={cn("acet-grid pointer-events-none absolute inset-0", className)} aria-hidden />;
}

/* ----------------------------- Shimmer ----------------------------- */

/** 微光扫过按钮 */
export function ShimmerButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "acet-shimmer relative overflow-hidden rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.03] active:scale-[0.98]",
        className,
      )}
    >
      <span className="relative z-10">{children}</span>
    </button>
  );
}
