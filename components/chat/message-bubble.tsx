"use client";

import { useState } from "react";
import { Check, Copy, FileText, FileVideo, RotateCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { AgnesIcon } from "@/components/agnes-logo";
import { Markdown } from "@/components/chat/markdown";
import { Button } from "@/components/ui/button";
import { formatBytes, type ChatMessage } from "@/lib/types";

interface MessageBubbleProps {
  message: ChatMessage;
  onRetry?: () => void;
  isStreaming?: boolean;
}

export function MessageBubble({ message, onRetry, isStreaming }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

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
                  <img src={a.content} alt={a.name} className="h-6 w-6 shrink-0 rounded object-cover" />
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
              <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-foreground align-middle" />
            ) : null}
          </>
        ) : (
          <div className="flex items-center gap-1.5 py-2" aria-label="正在生成">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
          </div>
        )}

        {/* 操作栏：复制 / 重新生成 */}
        {message.content && !message.error && !isStreaming ? (
          <div className="mt-2 flex items-center gap-1">
            <button
              onClick={copyMessage}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="复制"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
