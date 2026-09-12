"use client";

import * as React from "react";
import { useState } from "react";
import {
  Check,
  Copy,
  FileDown,
  FileText,
  FileVideo,
  RotateCw,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { AgnesIcon } from "@/components/agnes-logo";
import { ImageLightbox } from "@/components/chat/image-lightbox";
import { Markdown } from "@/components/chat/markdown";
import { Button } from "@/components/ui/button";
import { formatBytes, type ChatMessage } from "@/lib/types";

interface MessageBubbleProps {
  message: ChatMessage;
  onRetry?: () => void;
  isStreaming?: boolean;
}

/** 语言标注 → 文件扩展名 */
function extFromLang(lang: string): string {
  const map: Record<string, string> = {
    ts: "ts", typescript: "ts", tsx: "tsx",
    js: "js", javascript: "js", jsx: "jsx", mjs: "mjs",
    py: "py", python: "py",
    json: "json", yaml: "yaml", yml: "yml",
    html: "html", css: "css", scss: "scss",
    sh: "sh", bash: "sh", sql: "sql",
    go: "go", rs: "rs", java: "java", c: "c", cpp: "cpp", cs: "cs",
    md: "md", markdown: "md", txt: "txt",
  };
  return map[lang.toLowerCase().trim()] ?? "txt";
}

/** 抽出 Markdown 里的代码块，优先取最长的那一段 */
function extractCodeBlocks(text: string): { lang: string; code: string }[] {
  const re = /```([\w+-]*)\n([\s\S]*?)```/g;
  const out: { lang: string; code: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ lang: m[1] ?? "", code: m[2] ?? "" });
  }
  return out.sort((a, b) => b.code.length - a.code.length);
}

export function MessageBubble({ message, onRetry, isStreaming }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState<{ src: string; name: string } | null>(null);
  const isUser = message.role === "user";

  /**
   * 「AI 编辑并输出新版」的落地动作。
   *
   * 用户上传原文件 → 让 AI 改写 → 点「下载新版」拿到改好的文件。
   * 优先抽取代码块（按语言标注决定扩展名），没有代码块则保存全文。
   */
  const codeBlocks = React.useMemo(
    () => extractCodeBlocks(message.content),
    [message.content],
  );
  const hasCodeBlock = codeBlocks.length > 0;

  function downloadNewVersion() {
    const block = codeBlocks[0];
    const content = block?.code ?? message.content;
    const ext = block?.lang ? extFromLang(block.lang) : "txt";
    const base = (block?.lang ? `new-version` : "ai-output").replace(/[^\w.-]/g, "");
    const filename = `${base}${codeBlocks.length > 1 ? `-${codeBlocks.length}` : ""}.${ext}`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // 交给浏览器完成下载后再回收
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`已保存为 ${filename}`);
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      toast.success("已复制");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("复制失败");
    }
  }

  /* ---------------- 用户消息：右侧蓝色气泡 ---------------- */
  if (isUser) {
    const atts = message.attachments ?? [];
    return (
      <>
      <div className="flex animate-fade-in flex-col items-end gap-1.5">
        {/* 附件 */}
        {atts.length > 0 ? (
          <div className="flex max-w-[85%] flex-wrap justify-end gap-1.5 sm:max-w-[75%]">
            {atts.map((a) => (
              <span
                key={a.id}
                className="inline-flex max-w-[200px] items-center gap-1.5 rounded-lg border border-border/70 bg-muted/60 py-1 pl-1.5 pr-2 text-xs"
              >
                {a.kind === "image" && a.content ? (
                  <button
                    type="button"
                    onClick={() => setPreview({ src: a.content!, name: a.name })}
                    className="shrink-0 rounded transition-opacity hover:opacity-80"
                    title="点击查看原图"
                  >
                    <img
                      src={a.content}
                      alt={a.name}
                      className="h-6 w-6 rounded object-cover"
                    />
                  </button>
                ) : a.kind === "video" ? (
                  <FileVideo className="h-3.5 w-3.5 shrink-0 text-primary" />
                ) : (
                  <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                )}
                <span className="truncate text-fg-secondary">{a.name}</span>
                <span className="shrink-0 text-[10px] text-fg-quaternary">{formatBytes(a.size)}</span>
              </span>
            ))}
          </div>
        ) : null}
        {message.content ? (
          <div className="max-w-[85%] rounded-2xl rounded-br-lg bg-[hsl(var(--user-bubble))] px-4 py-2.5 text-[15px] leading-[1.75] text-[hsl(var(--user-bubble-foreground))] sm:max-w-[75%]">
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>
        ) : null}
      </div>
      {preview ? (
        <ImageLightbox src={preview.src} name={preview.name} onClose={() => setPreview(null)} />
      ) : null}
      </>
    );
  }

  /* ---------------- 助手消息：左侧头像 + 纯文本 ---------------- */
  return (
    <div className="flex animate-fade-in gap-3">
      {/* 头像 */}
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#4D6BFE] p-1.5 text-white">
        <AgnesIcon />
      </div>

      <div className="min-w-0 flex-1">
        {message.error ? (
          <div className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
            <div className="flex items-start gap-2 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{message.error}</span>
            </div>
            {onRetry ? (
              <Button size="sm" variant="outline" onClick={onRetry}>
                <RotateCw className="h-4 w-4" />
                重试
              </Button>
            ) : null}
          </div>
        ) : message.content ? (
          <>
            <Markdown content={message.content} />
            {isStreaming ? (
              <span className="ml-0.5 inline-block h-4 w-[2px] animate-caret bg-foreground align-middle" />
            ) : null}
          </>
        ) : (
          <div className="flex items-center gap-1.5 py-2" aria-label="正在生成">
            <span className="h-1.5 w-1.5 animate-dot rounded-full bg-primary [animation-delay:-0.6s]" />
            <span className="h-1.5 w-1.5 animate-dot rounded-full bg-primary [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-dot rounded-full bg-primary" />
          </div>
        )}

        {/* 操作栏：复制 / 存为新版文件 */}
        {message.content && !message.error && !isStreaming ? (
          <div className="mt-2 flex items-center gap-1">
            <button
              onClick={copyMessage}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="复制"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            {hasCodeBlock ? (
              <button
                onClick={downloadNewVersion}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="把 AI 生成的内容存为新版文件"
              >
                <FileDown className="h-3.5 w-3.5" />
                下载新版
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
