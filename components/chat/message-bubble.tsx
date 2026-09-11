"use client";

import { useMemo, useState } from "react";
import { Check, Copy, RotateCw, Sparkles, TriangleAlert, User } from "lucide-react";
import { toast } from "sonner";

import { Markdown } from "@/components/chat/markdown";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: ChatMessage;
  onRetry?: () => void;
  isStreaming?: boolean;
}

export function MessageBubble({ message, onRetry, isStreaming }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const initials = useMemo(() => (isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />), [isUser]);

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

  if (isUser) {
    return (
      <div className="flex animate-fade-in justify-end gap-3">
        <div className="max-w-[85%] rounded-2xl rounded-br-md brand-gradient px-4 py-2.5 text-[15px] leading-7 text-primary-foreground shadow-lg shadow-primary/20">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground">
          {initials}
        </div>
      </div>
    );
  }

  return (
    <div className="flex animate-fade-in gap-3">
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/15 text-primary">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl rounded-tl-md border border-border/60 bg-card/70 px-4 py-3 backdrop-blur-xl">
          {message.error ? (
            <div className="space-y-3">
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
            <Markdown content={message.content} />
          ) : (
            <div className="flex items-center gap-1 py-1" aria-label="正在生成">
              <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
            </div>
          )}
          {isStreaming && message.content ? (
            <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-primary align-middle" />
          ) : null}
        </div>

        {message.content && !message.error ? (
          <div className="mt-1.5 flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground"
              onClick={copyMessage}
              title="复制"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function MessageList({
  messages,
  onRetry,
  streamingId,
}: {
  messages: ChatMessage[];
  onRetry: () => void;
  streamingId: string | null;
}) {
  return (
    <div className={cn("mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6")}>
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} onRetry={onRetry} isStreaming={m.id === streamingId} />
      ))}
    </div>
  );
}
