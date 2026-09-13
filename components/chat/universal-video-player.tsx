"use client";

import * as React from "react";
import { Loader2, Play, TriangleAlert } from "lucide-react";

/**
 * 通用视频播放器。
 *
 * 浏览器原生只支持 mp4 / webm / ogg 三种容器。
 * wmv、mpg、mpg2、avi、flv、rmvb 这些**一律放不了** ——
 * 不是 bug，是浏览器根本没内置对应的解码器。
 *
 * 解决办法：把 ffmpeg 编译成 wasm，在浏览器里**现场转码成 mp4 再播放**。
 * 这就是用户说的"解码器内嵌"—— 解码在客户端完成，服务端只存原文件，
 * 既不消耗服务器 CPU，也不用把原片传出去。
 *
 * 为什么不打包进项目：ffmpeg.wasm 核心约 25~32MB，
 * 塞进仓库会让 Cloudflare Workers（免费版脚本上限 1 MiB）直接部署失败。
 * 所以改成**首次播放时才从 CDN 按需加载**，用到才下载。
 */

/** CDN 地址：用到的才加载，不进主包 */
const FFMPEG_CORE = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
const FFMPEG_JS = "https://unpkg.com/@ffmpeg/ffmpeg@0.12.15/dist/umd/ffmpeg.js";

type Phase =
  | { kind: "idle" }
  | { kind: "loading"; progress: string }
  | { kind: "transcoding"; progress: string }
  | { kind: "ready"; url: string }
  | { kind: "error"; message: string };

let ffmpegPromise: Promise<any> | null = null;

/** 惰性加载 ffmpeg.wasm（全站只加载一次） */
async function loadFFmpeg(onLog: (msg: string) => void): Promise<any> {
  if (ffmpegPromise) return ffmpegPromise;

  ffmpegPromise = (async () => {
    onLog("正在加载解码器…");
    // @ts-expect-error - UMD 包没有类型声明
    if (!window.FFmpegWASM) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = FFMPEG_JS;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("解码器加载失败，请检查网络"));
        document.head.appendChild(s);
      });
    }
    // @ts-expect-error - UMD 全局
    const { FFmpeg } = window.FFmpegWASM;
    const ffmpeg = new FFmpeg();
    ffmpeg.on("log", ({ message }: { message: string }) => {
      if (message) onLog(message.slice(0, 80));
    });
    await ffmpeg.load({
      coreURL: `${FFMPEG_CORE}/ffmpeg-core.js`,
      wasmURL: `${FFMPEG_CORE}/ffmpeg-core.wasm`,
    });
    return ffmpeg;
  })();

  return ffmpegPromise;
}

export function UniversalVideoPlayer({
  src,
  name,
  className,
}: {
  src: string;
  name: string;
  className?: string;
}) {
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  const native = ["mp4", "m4v", "webm", "ogv", "ogg"].includes(ext);

  const [phase, setPhase] = React.useState<Phase>({ kind: "idle" });
  const objectUrlRef = React.useRef<string | null>(null);

  // 卸载时回收 Blob，避免内存泄漏
  React.useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  async function transcode() {
    setPhase({ kind: "loading", progress: "准备中…" });
    try {
      const ffmpeg = await loadFFmpeg((progress) =>
        setPhase((p) => (p.kind === "idle" ? p : { ...p, progress })),
      );

      setPhase({ kind: "transcoding", progress: "读取文件…" });
      // 同源直传一般都允许 CORS；跨域的话需要存储桶放开 CORS
      const buf = await fetch(src).then((r) => {
        if (!r.ok) throw new Error(`文件读取失败（HTTP ${r.status}）`);
        return r.arrayBuffer();
      });

      const inName = `in.${ext || "dat"}`;
      await ffmpeg.writeFile(inName, new Uint8Array(buf));

      setPhase({ kind: "transcoding", progress: "转码为 MP4…" });
      /**
       * -c:v libx264 转 H.264（兼容性最好）
       * -preset ultrafast 牺牲体积换速度，浏览器里要快
       * -movflags +faststart 让视频边下边播
       * -c:a aac  音频转 AAC，否则部分浏览器无声
       */
      const code = await ffmpeg.exec([
        "-i", inName,
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-c:a", "aac",
        "-y", "out.mp4",
      ]);

      if (code !== 0) throw new Error("转码失败，该文件编码可能不受支持");

      const out = await ffmpeg.readFile("out.mp4");
      await ffmpeg.deleteFile(inName);
      await ffmpeg.deleteFile("out.mp4");

      const url = URL.createObjectURL(
        new Blob([out as Uint8Array], { type: "video/mp4" }),
      );
      objectUrlRef.current = url;
      setPhase({ kind: "ready", url });
    } catch (err) {
      setPhase({
        kind: "error",
        message: err instanceof Error ? err.message : "转码失败",
      });
    }
  }

  /* ---------- 能直接播的格式 ---------- */
  if (native) {
    return (
      <video
        src={src}
        controls
        preload="metadata"
        className={className ?? "max-h-[420px] w-full rounded-[var(--radius-card)] bg-black"}
      >
        你的浏览器不支持视频播放。
      </video>
    );
  }

  /* ---------- 需要转码的格式 ---------- */

  if (phase.kind === "ready") {
    return (
      <div className="space-y-2">
        <video
          src={phase.url}
          controls
          autoPlay
          className={className ?? "max-h-[420px] w-full rounded-[var(--radius-card)] bg-black"}
        />
        <p className="text-xs text-fg-tertiary">
          已由内置解码器转为 MP4 播放（原文件未改动）
        </p>
      </div>
    );
  }

  if (phase.kind === "loading" || phase.kind === "transcoding") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-border bg-muted/40 px-5 py-7">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <p className="text-sm font-medium">{phase.progress}</p>
        <p className="max-w-[280px] text-center text-xs text-fg-tertiary">
          .{ext} 浏览器无法直接播放，正在用内置解码器转换。文件越大耗时越久。
        </p>
      </div>
    );
  }

  if (phase.kind === "error") {
    return (
      <div className="space-y-2 rounded-[var(--radius-card)] border border-destructive/30 bg-destructive/5 px-4 py-3">
        <p className="flex items-start gap-2 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {phase.message}
        </p>
        <p className="text-xs text-fg-tertiary">
          可以下载原文件后用本地播放器（如 VLC）打开。
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-border bg-muted/40 px-5 py-6">
      <p className="text-sm">
        <span className="font-medium">{name}</span>
      </p>
      <p className="max-w-[300px] text-center text-xs text-fg-tertiary">
        .{ext} 不是浏览器原生格式，需要先用内置解码器转换为 MP4。
      </p>
      <button
        type="button"
        onClick={() => void transcode()}
        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.03] active:scale-[0.98]"
      >
        <Play className="h-3.5 w-3.5" />
        解码并播放
      </button>
    </div>
  );
}
