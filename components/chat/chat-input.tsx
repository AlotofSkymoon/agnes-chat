"use client";

import * as React from "react";
import { ArrowUp, Square } from "lucide-react";

import { ModelPicker } from "@/components/chat/model-picker";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  streaming: boolean;
  /** 空状态时用大号样式 */
  variant?: "default" | "hero";
  model?: string;
  onModelChange?: (modelId: string) => void;
  placeholder?: string;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  onStop,
  streaming,
  variant = "default",
  model,
  onModelChange,
  placeholder = "给 Agnes 发送消息",
}: ChatInputProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // 自适应高度
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onSubmit();
    }
  }

  const isHero = variant === "hero";

  return (
    <div
      className={
        isHero
          ? "w-full rounded-2xl border border-border bg-card px-4 pb-3 pt-3.5 shadow-sm transition-colors focus-within:border-primary/60"
          : "w-full rounded-2xl border border-border bg-card px-3 pb-2.5 pt-3 shadow-sm transition-colors focus-within:border-primary/60"
      }
    >
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className={
          isHero
            ? "w-full resize-none bg-transparent text-[15px] leading-6 outline-none placeholder:text-muted-foreground"
            : "max-h-[200px] w-full resize-none bg-transparent px-1 text-[15px] leading-6 outline-none placeholder:text-muted-foreground"
        }
      />

      <div className="mt-2 flex items-center justify-between gap-2">
        {/* 左侧：模型选择小框 */}
        <div className="min-w-0">
          {model && onModelChange ? (
            <ModelPicker value={model} onChange={onModelChange} />
          ) : null}
        </div>

        {/* 右侧：发送 / 停止 */}
        <div className="flex shrink-0 items-center gap-2">
          {streaming ? (
            <button
              onClick={onStop}
              className="flex h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3.5 text-sm transition-colors hover:bg-muted"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              停止
            </button>
          ) : (
            <button
              onClick={onSubmit}
              disabled={!value.trim()}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#4D6BFE] text-white transition-all hover:bg-[#3757E4] disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
              title="发送"
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
