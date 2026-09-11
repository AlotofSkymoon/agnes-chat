"use client";

import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

const SUGGESTIONS = [
  "帮我写一段自我介绍",
  "用通俗的话解释什么是向量数据库",
  "帮我润色这段邮件",
  "写一个 Python 快速排序",
];

export function EmptyState({ onPick, onStart }: { onPick: (text: string) => void; onStart: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl brand-gradient shadow-2xl shadow-primary/30">
        <Sparkles className="h-8 w-8 text-primary-foreground" />
      </div>
      <h1 className="bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
        Agnes AI 免费试用
      </h1>
      <p className="mt-3 text-sm text-muted-foreground sm:text-base">仅聊天，无 Agent 功能</p>

      <Button size="lg" className="mt-8" onClick={onStart}>
        <Sparkles className="h-4 w-4" />
        开始聊天
      </Button>

      <div className="mt-10 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-xl border border-border/70 bg-card/50 px-4 py-3 text-left text-sm text-muted-foreground transition-all hover:border-primary/40 hover:bg-accent hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        纯文本聊天 · 聊天记录默认只保存在你的浏览器本地
      </p>
    </div>
  );
}
