"use client";

import { AgnesIcon } from "@/components/agnes-logo";

const SUGGESTIONS = [
  { title: "帮我写一段自我介绍", sub: "简洁、有记忆点" },
  { title: "用通俗的话解释向量数据库", sub: "并举一个例子" },
  { title: "帮我润色这段邮件", sub: "更专业得体" },
  { title: "写一个 Python 快速排序", sub: "带注释" },
];

export function EmptyState({ onPick }: { onPick: (text: string) => void }) {

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-5">
      {/* 主标题区 */}
      <div className="mt-4 flex flex-col items-center text-center">
        <span className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#4D6BFE] to-[#7B8CFF] p-3 text-white shadow-lg shadow-[#4D6BFE]/25">
          <AgnesIcon />
        </span>
        <h1 className="text-[26px] font-semibold tracking-tight sm:text-[30px]">
          我是 Agnes，很高兴见到你！
        </h1>
        <p className="mt-2.5 text-[15px] text-fg-secondary">有什么可以帮到你？</p>
        <p className="mt-3 inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
          仅聊天，无 Agent 功能
        </p>
      </div>

      {/* 推荐问题 */}
      <div className="mt-10 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.title}
            type="button"
            onClick={() => onPick(s.title)}
            className="group rounded-xl border border-border bg-card px-4 py-3 text-left transition-all hover:border-primary/50 hover:bg-accent/60"
          >
            <span className="block text-sm font-medium text-foreground">{s.title}</span>
            <span className="mt-0.5 block text-xs text-fg-tertiary">{s.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
