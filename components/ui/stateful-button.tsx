"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * 带状态的按钮：idle → pending → success / error。
 *
 * 用在"传送讯息"这类需要等结果的动作上：
 * 等待期间按钮必须给出反馈，否则用户会以为没点上而反复点击。
 *
 * ⚠️ 卸载后不能再 setState（React 会警告），所以全程用一个 ref 标记存活。
 * 另外 pending 中要禁用按钮，避免重复提交。
 */

type Phase = "idle" | "pending" | "success" | "error";

export function Button({
  onClick,
  children,
  className,
  pendingText = "传送中…",
  successText = "已传送 ✓",
  errorText = "传送失败",
  /** 成功后多久回到初始状态；传 0 则保持 success */
  resetAfter = 2000,
  /**
   * 最短等待时长。
   * 很多提交动作是同步返回的（比如"把消息交给流式输出"），
   * 不设下限的话 pending 态一帧就过去了，用户根本看不到反馈，
   * 会以为没点上而反复点击。
   */
  minPendingMs = 0,
  disabled,
}: {
  onClick: () => Promise<void> | void;
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
  successText?: string;
  errorText?: string;
  resetAfter?: number;
  minPendingMs?: number;
  disabled?: boolean;
}) {
  const [phase, setPhase] = React.useState<Phase>("idle");
  const alive = React.useRef(true);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function handle() {
    if (phase === "pending") return;
    setPhase("pending");
    try {
      if (minPendingMs > 0) {
        await Promise.allSettled([
          onClick(),
          new Promise<void>((r) => setTimeout(r, minPendingMs)),
        ]);
      } else {
        await onClick();
      }
      if (!alive.current) return;
      setPhase("success");
      if (resetAfter > 0) {
        timer.current = setTimeout(() => {
          if (alive.current) setPhase("idle");
        }, resetAfter);
      }
    } catch {
      if (!alive.current) return;
      setPhase("error");
      timer.current = setTimeout(() => {
        if (alive.current) setPhase("idle");
      }, resetAfter > 0 ? resetAfter : 2000);
    }
  }

  const label =
    phase === "pending" ? pendingText : phase === "success" ? successText : phase === "error" ? errorText : children;

  return (
    <button
      type="button"
      onClick={handle}
      disabled={disabled || phase === "pending"}
      aria-busy={phase === "pending"}
      className={cn(
        "group relative inline-flex h-11 items-center justify-center gap-2 overflow-hidden rounded-full px-7",
        "text-sm font-medium text-white shadow-lg transition-all duration-300",
        "bg-gradient-to-r from-violet-600 to-fuchsia-600",
        "hover:shadow-xl hover:brightness-110 active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:opacity-80",
        phase === "success" && "from-emerald-600 to-teal-600",
        phase === "error" && "from-rose-600 to-red-600",
        className,
      )}
    >
      {/* 斜向扫光：只在非等待态常驻，等待时让位给 spinner */}
      {phase === "idle" ? (
        <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      ) : null}

      {phase === "pending" ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      ) : null}
      <span className="relative">{label}</span>
    </button>
  );
}
