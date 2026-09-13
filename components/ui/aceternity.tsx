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

/* --------------------------- Pointer Tracker --------------------------- */

/**
 * 把鼠标相对位置写成 CSS 变量（--mx / --my）。
 *
 * 抽出来是因为 Spotlight / Glow / Pointer 三个效果都要它，
 * 而且必须**直接操作 style 而不走 state** ——
 * 否则每次 mousemove 都触发一次 React 重渲染，卡片多了会明显掉帧。
 */
function usePointerVars<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);

  const onMouseMove = React.useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  }, []);

  return { ref, onMouseMove };
}

/* ------------------------------ Glow Card ------------------------------ */

/**
 * Glowing Effect：只在边框上跟随鼠标发光，内部保持干净。
 * 适合叠在已有卡片上（spolight 会在内部铺光，文字多时反而脏）。
 */
export function GlowCard({
  children,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: React.ElementType;
}) {
  const { ref, onMouseMove } = usePointerVars<HTMLElement>();

  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement>}
      onMouseMove={onMouseMove}
      className={cn("acet-glow", className)}
    >
      {children}
    </Tag>
  );
}

/* ------------------------------- Meteors ------------------------------- */

/** 斜向下落的流星带尾迹。纯装饰，用 useMemo 固定随机参数避免重渲染抖动。 */
export function Meteors({ count = 14, className }: { count?: number; className?: string }) {
  const meteors = React.useMemo(
    () =>
      Array.from({ length: count }, () => ({
        left: `${Math.random() * 100}%`,
        width: `${40 + Math.random() * 90}px`,
        delay: `${Math.random() * 8}s`,
        duration: `${5 + Math.random() * 7}s`,
      })),
    [count],
  );

  return (
    <div className={cn("acet-meteors", className)} aria-hidden>
      {meteors.map((m, i) => (
        <i
          key={i}
          style={{ left: m.left, width: m.width, animationDelay: m.delay, animationDuration: m.duration }}
        />
      ))}
    </div>
  );
}

/* ------------------------------ Sparkles ------------------------------ */

/** 随机闪现的星点。用在标题、空状态上做点缀。 */
export function Sparkles({ count = 10, className }: { count?: number; className?: string }) {
  const stars = React.useMemo(
    () =>
      Array.from({ length: count }, () => ({
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        delay: `${Math.random() * 3}s`,
        duration: `${1.6 + Math.random() * 2}s`,
      })),
    [count],
  );

  return (
    <div className={cn("acet-sparkles", className)} aria-hidden>
      {stars.map((s, i) => (
        <i
          key={i}
          style={{ left: s.left, top: s.top, animationDelay: s.delay, animationDuration: s.duration }}
        />
      ))}
    </div>
  );
}

/* ----------------------------- Move Border ----------------------------- */

/** 沿边框循环流动的流光，适合主按钮。 */
export function MovingBorder({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "acet-moving-border relative rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.03] active:scale-[0.98]",
        className,
      )}
    >
      <span className="relative z-10">{children}</span>
    </button>
  );
}

/* ----------------------------- Tracing Beam ----------------------------- */

/** 沿左侧向下流动的光束，给内容流一点方向感。 */
export function TracingBeam({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("acet-tracing-beam", className)}>{children}</div>;
}

/* --------------------------- Pointer Highlight --------------------------- */

/** 鼠标位置的弥散光晕，比 spotlight 更淡，适合铺在文本/代码块上。 */
export function PointerHighlight({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { ref, onMouseMove } = usePointerVars<HTMLDivElement>();

  return (
    <div ref={ref} onMouseMove={onMouseMove} className={cn("acet-pointer", className)}>
      {children}
    </div>
  );
}

/* -------------------------------- Vortex -------------------------------- */

/** 旋涡背景（多层 conic 反向旋转 + 模糊）。适合空状态、登录页。 */
export function Vortex({ className }: { className?: string }) {
  return (
    <div className={cn("acet-vortex", className)} aria-hidden>
      <i />
      <i />
    </div>
  );
}

/* --------------------------------- Lamp --------------------------------- */

/** 顶部落下的锥形光束，作区块头部的视觉锚点。 */
export function Lamp({ className }: { className?: string }) {
  return <div className={cn("acet-lamp", className)} aria-hidden />;
}

/* ------------------------------ Bento Grid ------------------------------ */

/**
 * Bento 栅格容器。
 * 精髓是**卡片有大有小**形成节奏，所以要配合 wide / tall 使用。
 */
export function BentoGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("acet-bento", className)}>{children}</div>;
}

/** Bento 里横跨两列的卡片 */
export function BentoWide({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("acet-bento-wide acet-wobble p-4", className)}>{children}</div>
  );
}

/** Bento 里纵跨两行的卡片 */
export function BentoCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("acet-wobble p-4", className)}>{children}</div>;
}

/* ------------------------------ Noise Layer ------------------------------ */

/** 极淡噪点，压住大面积渐变的塑料感。 */
export function Noise({ className }: { className?: string }) {
  return <div className={cn("acet-noise pointer-events-none absolute inset-0", className)} aria-hidden />;
}

/* ---------------------------- Text Shimmer ---------------------------- */

/** 沿文字扫过的高光，用于标题。 */
export function TextShimmer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn("acet-text-shimmer", className)}>{children}</span>;
}
