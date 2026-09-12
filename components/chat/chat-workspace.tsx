"use client";

import * as React from "react";
import Link from "next/link";
import { Compass, Eraser, Menu, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { ChatInput } from "@/components/chat/chat-input";
import { EmptyState } from "@/components/chat/empty-state";
import { MessageBubble } from "@/components/chat/message-bubble";
import { SettingsDialog, type ChatSettings } from "@/components/chat/settings-dialog";
import { Sidebar } from "@/components/chat/sidebar";
import { Button } from "@/components/ui/button";
import { DEFAULT_MODEL, LS_KEYS } from "@/lib/config";
import { createId, type ChatMessage } from "@/lib/types";
import { useConversations } from "@/lib/use-conversations";

interface SafeUser {
  id: string;
  email: string;
  role: "admin" | "user";
  createdAt: string;
}

const DEFAULT_SETTINGS: ChatSettings = {
  keys: { agnes: "", deepseek: "" },
  baseUrl: "",
  model: DEFAULT_MODEL,
};

export function ChatWorkspace({ user }: { user: SafeUser | null }) {
  const {
    conversations,
    currentId,
    messages,
    setMessages,
    loaded,
    newConversation,
    selectConversation,
    deleteConversation,
    clearAllConversations,
    ensureConversation,
  } = useConversations();

  const [mounted, setMounted] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "streaming">("idle");
  const [streamingId, setStreamingId] = React.useState<string | null>(null);
  const [settings, setSettings] = React.useState<ChatSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [cloudSync, setCloudSync] = React.useState(false);

  const abortRef = React.useRef<AbortController | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const messagesRef = React.useRef<ChatMessage[]>([]);

  React.useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  /* ------------------------------ 初始化设置 ------------------------------ */
  React.useEffect(() => {
    try {
      // 新版：各服务商分开存；兼容旧版单一 apiKey
      let keys: Record<string, string> = { agnes: "", deepseek: "" };
      const rawKeys = localStorage.getItem(LS_KEYS.keys);
      if (rawKeys) {
        try {
          const parsed = JSON.parse(rawKeys) as Record<string, string>;
          keys = { agnes: parsed.agnes ?? "", deepseek: parsed.deepseek ?? "" };
        } catch {
          /* 忽略 */
        }
      }
      // 迁移：旧版本存的单一 apiKey 当作 Agnes Key
      const legacy = localStorage.getItem(LS_KEYS.apiKey) ?? "";
      if (!keys.agnes && legacy) {
        keys.agnes = legacy;
        localStorage.setItem(LS_KEYS.keys, JSON.stringify(keys));
      }

      const saved: ChatSettings = {
        keys: keys as ChatSettings["keys"],
        baseUrl: localStorage.getItem(LS_KEYS.baseUrl) ?? "",
        model: localStorage.getItem(LS_KEYS.model) ?? DEFAULT_MODEL,
      };
      setSettings(saved);
      setCloudSync(localStorage.getItem(LS_KEYS.cloudSync) === "true");
    } catch {
      /* 忽略 */
    }
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem(LS_KEYS.cloudSync, String(cloudSync));
    } catch {
      /* 忽略 */
    }
  }, [cloudSync, mounted]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  /* ------------------------------ 流式请求 ------------------------------ */
  const runCompletion = React.useCallback(
    async (history: ChatMessage[], conversationId: string) => {
      const assistantId = createId();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", createdAt: Date.now() },
      ]);
      messagesRef.current = [
        ...messagesRef.current,
        { id: assistantId, role: "assistant", content: "", createdAt: Date.now() },
      ];
      setStreamingId(assistantId);
      setStatus("streaming");

      const controller = new AbortController();
      abortRef.current = controller;

      const patchAssistant = (patch: Partial<ChatMessage>) =>
        setMessages((prev) => {
          const next = prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m));
          messagesRef.current = next;
          return next;
        });

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            messages: history
              .filter((m) => !m.error)
              .map((m) => ({ role: m.role, content: m.content })),
            model: settings.model,
            keys: settings.keys,
            baseUrl: settings.baseUrl,
            conversationId,
            saveToCloud: Boolean(user) && cloudSync,
          }),
        });

        if (!res.ok || !res.body) {
          let message = "请求失败，请稍后重试";
          if (res.status === 401) message = "Agnes API Key 无效，请在设置中检查你的 Key";
          else if (res.status === 429) message = "请求过快，请稍后再试";
          else if (res.status >= 500) message = "服务暂时不可用，请稍后重试";
          else {
            try {
              const data = (await res.json()) as { error?: string };
              message = data.error || message;
            } catch {
              /* 忽略 */
            }
          }
          patchAssistant({ error: message });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              const delta: string = json?.choices?.[0]?.delta?.content ?? "";
              if (delta) {
                acc += delta;
                patchAssistant({ content: acc });
              }
            } catch {
              /* SSE 分片，忽略 */
            }
          }
        }

        if (!acc) patchAssistant({ error: "未收到模型返回内容，请重试" });
      } catch (error) {
        const isAbort = (error as Error)?.name === "AbortError";
        patchAssistant({ error: isAbort ? "已停止生成" : "网络错误，请检查连接后重试" });
      } finally {
        setStatus("idle");
        setStreamingId(null);
        abortRef.current = null;
      }
    },
    [cloudSync, settings.baseUrl, settings.keys, settings.model, setMessages, user],
  );

  const send = React.useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || status === "streaming") return;

      // 确保有当前会话
      let convId = currentId;
      let base: ChatMessage[];
      if (!convId) {
        convId = newConversation();
        base = [];
      } else {
        base = messagesRef.current.filter((m) => !m.error);
        ensureConversation(convId, text);
      }

      const userMessage: ChatMessage = {
        id: createId(),
        role: "user",
        content: text,
        createdAt: Date.now(),
      };
      const next = [...base, userMessage];
      messagesRef.current = next;
      setMessages(next);
      setInput("");
      void runCompletion(next, convId);
    },
    [currentId, ensureConversation, newConversation, runCompletion, setMessages, status],
  );

  const retry = React.useCallback(() => {
    const cleaned = messagesRef.current.filter((m) => !m.error && m.content.trim() !== "");
    if (cleaned.length === 0) return;
    messagesRef.current = cleaned;
    setMessages(cleaned);
    void runCompletion(cleaned, currentId);
  }, [currentId, runCompletion, setMessages]);

  function stop() {
    abortRef.current?.abort();
  }

  function handleNew() {
    abortRef.current?.abort();
    newConversation();
    setInput("");
  }

  function handleClearCurrent() {
    abortRef.current?.abort();
    messagesRef.current = [];
    setMessages([]);
    toast.success("已清空当前对话");
  }

  function clearAllData() {
    abortRef.current?.abort();
    messagesRef.current = [];
    setMessages([]);
    setSettings(DEFAULT_SETTINGS);
    setCloudSync(false);
    clearAllConversations();
    try {
      Object.values(LS_KEYS).forEach((k) => {
        if (k !== LS_KEYS.theme) localStorage.removeItem(k);
      });
    } catch {
      /* 忽略 */
    }
    toast.success("已清空全部本地数据");
  }

  function saveSettings(next: ChatSettings) {
    setSettings(next);
    try {
      localStorage.setItem(LS_KEYS.keys, JSON.stringify(next.keys));
      localStorage.setItem(LS_KEYS.baseUrl, next.baseUrl);
      localStorage.setItem(LS_KEYS.model, next.model);
    } catch {
      /* 忽略 */
    }
    toast.success("设置已保存");
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      {/* 侧边栏 */}
      <Sidebar
        conversations={conversations}
        currentId={currentId}
        onSelect={selectConversation}
        onNew={handleNew}
        onDelete={deleteConversation}
        onClearAll={clearAllData}
        onOpenSettings={() => setSettingsOpen(true)}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        user={user}
      />

      {/* 主区域 */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 顶栏（对话态才显示） */}
        {!isEmpty ? (
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>
              <span className="truncate text-sm text-muted-foreground">
                {conversations.find((c) => c.id === currentId)?.title ?? "新对话"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" asChild title="导航站">
                <Link href="/nav">
                  <Compass className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" onClick={handleClearCurrent} title="清空当前对话">
                <Eraser className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} title="设置">
                <Settings2 className="h-4 w-4" />
              </Button>
            </div>
          </header>
        ) : (
          <header className="flex h-14 shrink-0 items-center justify-between px-3 md:hidden">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" asChild title="导航站">
                <Link href="/nav">
                  <Compass className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)}>
                <Settings2 className="h-4 w-4" />
              </Button>
            </div>
          </header>
        )}

        {/* 消息区 */}
        <main className="min-h-0 flex-1 overflow-y-auto">
          {isEmpty ? (
            <div className="flex min-h-full flex-col justify-center py-6">
              <EmptyState onPick={(text) => send(text)} />
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  onRetry={retry}
                  isStreaming={m.id === streamingId}
                />
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </main>

        {/* 输入区 */}
        <div className="shrink-0 px-4 pb-4">
          <div className="mx-auto w-full max-w-3xl">
            {isEmpty ? (
              <>
                <ChatInput
                  variant="hero"
                  value={input}
                  onChange={setInput}
                  onSubmit={() => send(input)}
                  onStop={stop}
                  streaming={status === "streaming"}
                  placeholder="给 Agnes 发送消息"
                />
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  内容由 AI 生成，仅供参考 · 仅聊天，无 Agent / 联网 / 文件上传
                </p>
              </>
            ) : (
              <>
                <ChatInput
                  value={input}
                  onChange={setInput}
                  onSubmit={() => send(input)}
                  onStop={stop}
                  streaming={status === "streaming"}
                  model={mounted ? settings.model : undefined}
                  placeholder="给 Agnes 发送消息"
                />
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  内容由 AI 生成，仅供参考
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onSave={saveSettings}
        user={user}
        cloudSync={cloudSync}
        onCloudSyncChange={setCloudSync}
        onClearAll={clearAllData}
      />
    </div>
  );
}
