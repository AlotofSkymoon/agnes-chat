"use client";

import * as React from "react";
import { Download, X, ZoomIn, ZoomOut } from "lucide-react";

import { useI18n } from "@/components/i18n-provider";

/**
 * 图片预览：点缩略图看原图。
 *
 * 支持滚轮/按钮缩放、拖拽平移、点背景关闭、Esc 关闭。
 * 用于查看「原始图片」—— 发送给模型的是压缩版，但预览始终显示原图。
 */
export function ImageLightbox({
  src,
  name,
  onClose,
}: {
  src: string;
  name?: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [scale, setScale] = React.useState(1);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    // 打开时锁定背景滚动
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // 滚轮缩放
  const onWheel = React.useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.min(5, Math.max(0.2, s - e.deltaY * 0.0015)));
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/85 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* 顶部工具条 */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="truncate text-sm opacity-80">{name ?? t("image.preview")}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.2, s - 0.25))}
            className="rounded-lg p-2 hover:bg-white/15"
            aria-label={t("common.zoomOut")}
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="min-w-[3rem] text-center text-xs tabular-nums opacity-70">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(5, s + 0.25))}
            className="rounded-lg p-2 hover:bg-white/15"
            aria-label={t("common.zoomIn")}
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <a
            href={src}
            download={name}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-lg p-2 hover:bg-white/15"
            aria-label={t("image.downloadOriginal")}
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-white/15"
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 图片区 */}
      <div
        className="flex flex-1 items-center justify-center overflow-auto p-4"
        onWheel={onWheel}
        onClick={onClose}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name ?? t("image.alt")}
          onClick={(e) => e.stopPropagation()}
          style={{ transform: `scale(${scale})` }}
          className="max-h-full max-w-full origin-center rounded-lg object-contain transition-transform duration-150"
          draggable={false}
        />
      </div>

      <p className="pb-4 text-center text-[11px] text-white/50">
        {t("image.hint")}
      </p>
    </div>
  );
}
