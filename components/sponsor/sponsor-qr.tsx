"use client";

import * as React from "react";
import { QrCode, TriangleAlert } from "lucide-react";

import { SPONSOR_QR } from "@/lib/site";

/**
 * 收款二维码卡片。
 *
 * ⚠️ 为什么做成客户端组件 + onError 降级：
 * 二维码图片是站长自己放的（public/sponsor-qr.png 或外链）。
 * 忘了放、或外链过期时，用 <img> 会显示一个破图图标 ——
 * 在赞助页上非常难看，而且访客不知道发生了什么。
 *
 * 这里在加载失败时切成一张说明卡：
 * 访客看到的是"站长还没放收款码"，站长看到的是"该去哪配置"。
 */
export function SponsorQr({ method, note }: { method: string; note: string }) {
  const [failed, setFailed] = React.useState(false);

  return (
    <section className="flex flex-col items-center">
      <div className="w-full max-w-[320px] rounded-[var(--r-2xl)] border border-border bg-card/70 p-6 shadow-[var(--shadow-card)] backdrop-blur-xl">
        {failed ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <TriangleAlert className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">收款码暂未配置</p>
            <p className="text-xs leading-relaxed text-fg-tertiary">
              站长还没放上收款码。
              <br />
              可把图片存为 <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">public/sponsor-qr.png</code>
              ，或设置环境变量 <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">NEXT_PUBLIC_SPONSOR_QR</code>。
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-center gap-1.5 text-xs text-fg-tertiary">
              <QrCode className="h-3.5 w-3.5" />
              {method}
            </div>
            {/*
              用原生 img 而不是 next/image ——
              项目已全局关闭图片优化（images.unoptimized），且二维码是本地静态资源，
              用 next/image 反而会多一层无谓的处理与配置约束。
            */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={SPONSOR_QR}
              alt={`${method} 收款二维码`}
              width={640}
              height={640}
              loading="lazy"
              decoding="async"
              onError={() => setFailed(true)}
              className="mx-auto aspect-square w-full rounded-[var(--radius-card)] bg-white object-contain"
            />
            <p className="mt-4 text-center text-xs leading-relaxed text-fg-tertiary">
              {note}
            </p>
          </>
        )}
      </div>

      {!failed ? (
        <p className="mt-3 text-center text-[11px] text-fg-quaternary">
          长按或扫描二维码 · 金额随意
        </p>
      ) : null}
    </section>
  );
}
