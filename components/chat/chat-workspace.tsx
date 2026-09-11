"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  Eraser,
  LogIn,
  Moon,
  Settings2,
  Shield,
  Square,
  Sun,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/chat/empty-state";
import { MessageList } from "@/components/chat/message-bubble";
import { SettingsDialog, type ChatSettings } from "@/components/chat/settings-dialog";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { DEFAULT_BASE_URL, DEFAULT_MODEL, LS_KEYS } from "@/lib/config";
import { createId, type ChatMessage } from "@/lib/types";

interface SafeUser {
  id: string;
  email: string;
  role: "admin" | "user";
  createdAt: string;
}

const DEFAULT_SETTINGS: ChatSettings = {
  apiKey: "",
  baseUrl: DEFAULT_BASE_URL,
  model: DEFAULT_MODEL,
};

export function ChatWorkspace({ user }: { user: SafeUser | null }) {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const [mounted, setMounted] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "streaming">("idle");
  const [streamingId, setStreamingId] = React.useState<string | null>(null);
  const [settings, setSettings] = React.useState<ChatSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [cloudSync, setCloudSync] = React.useState(false);
  const [conversationId, setConversationId] = React.useState<string>("");

  const abortRef = React.useRef<AbortController | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  /** 始终持有最新消息，避免在 setState updater 里触发副作用 */
  const messagesRef = React.useRef<ChatMessage[]>([]);

  React.useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  /* ------------------------------ 初始化（避免 SSR hydration 不一致） ----------------------------- */
  React.useEffect(() => {
    try {
      const rawMessages = localStorage.getItem(LS_KEYS.messages);
      if (rawMessages) setMessages(JSON.parse(rawMessages) as ChatMessage[]);

      const savedSettings: ChatSettings = {
        apiKey: localStorage.getItem(LS_KEYS.apiKey) ?? "",
        baseUrl: localStorage.getItem(LS_KEYS.baseUrl) ?? DEFAULT_BASE_URL,
        model: localStorage.getItem(LS_KEYS.model) ?? DEFAULT_MODEL,
      };
      setSettings(savedSettings);

      let convId = localStorage.getItem(LS_KEYS.conversationId) ?? "";
      if (!convId) {
        convId = createId();
        localStorage.setItem(LS_KEYS.conversationId, convId);
      }
      setConversationId(convId);

      setCloudSync(localStorage.getItem(LS_KEYS.cloudSync) === "true");
    } catch {
      /* localStorage 不可用则忽略 */
    }
    setMounted(true);
  }, []);

  /* ------------------------------ 本地持久化 ------------------------------ */
  React.useEffect(() => {
    if (!mounted) return;
    try {
      if (messages.length === 0) localStorage.removeItem(LS_KEYS.messages);
      else localStorage.setItem(LS_KEYS.messages, JSON.stringify(messages));
    } catch {
      /* 忽略 */
    }
  }, [messages, mounted]);

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

  /* ------------------------------ 核心：请求 + 流式 ------------------------------ */
  const runCompletion = React.useCallback(
    async (history: ChatMessage[]) => {
      const assistantId = createId();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", createdAt: Date.now() },
      ]);
      setStreamingId(assistantId);
      setStatus("streaming");

      const controller = new AbortController();
      abortRef.current = controller;

      const patchAssistant = (patch: Partial<ChatMessage>) =>
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m)));

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
            apiKey: settings.apiKey,
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
        if (isAbort) {
          patchAssistant({ error: "已停止生成" });
        } else {
          patchAssistant({ error: "网络错误，请检查连接后重试" });
        }
      } finally {
        setStatus("idle");
        setStreamingId(null);
        abortRef.current = null;
      }
    },
    [cloudSync, conversationId, settings.apiKey, settings.baseUrl, settings.model, user],
  );

  const send = React.useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || status === "streaming") return;
      const userMessage: ChatMessage = {
        id: createId(),
        role: "user",
        content: text,
        createdAt: Date.now(),
      };
      setMessages((prev) => {
        const next = [...prev.filter((m) => !m.error), userMessage];
        void runCompletion(next);
        return next;
      });
      setInput("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    },
    [runCompletion, status],
  );

  const retry = React.useCallback(() => {
    setMessages((prev) => {
      const cleaned = prev.filter((m) => !m.error && m.content.trim() !== "");
      if (cleaned.length === 0) return [];
      void runCompletion(cleaned);
      return cleaned;
    });
  }, [runCompletion]);

  function stop() {
    abortRef.current?.abort();
  }

  function clearChat() {
    abortRef.current?.abort();
    setMessages([]);
    const newId = createId();
    setConversationId(newId);
    try {
      localStorage.removeItem(LS_KEYS.messages);
      localStorage.setItem(LS_KEYS.conversationId, newId);
    } catch {
      /* 忽略 */
    }
    toast.success("已清空当前对话");
  }

  function clearAllData() {
    abortRef.current?.abort();
    messagesRef.current = [];
    setMessages([]);
    setSettings(DEFAULT_SETTINGS);
    setCloudSync(false);
    const newId = createId();
    setConversationId(newId);
    try {
      Object.values(LS_KEYS).forEach((k) => {
        if (k !== LS_KEYS.theme) localStorage.removeItem(k);
      });
      localStorage.setItem(LS_KEYS.conversationId, newId);
    } catch {
      /* 忽略 */
    }
    toast.success("已清空全部本地数据");
  }

  function saveSettings(next: ChatSettings) {
    setSettings(next);
    try {
      localStorage.setItem(LS_KEYS.apiKey, next.apiKey);
      localStorage.setItem(LS_KEYS.baseUrl, next.baseUrl);
      localStorage.setItem(LS_KEYS.model, next.model);
    } catch {
      /* 忽略 */
    }
    toast.success("设置已保存");
  }

  /* ------------------------------ 渲染 ------------------------------ */
  const isEmpty = messages.length === 0;

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 aurora" />

      {/* 顶部栏 */}
      <header className="relative z-10 flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5 backdrop-blur-xl sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl brand-gradient text-primary-foreground shadow-lg shadow-primary/30">
              <Settings2 className="h-4 w-4" />
            </span>
            <span className="truncate text-sm font-semibold sm:text-base">Agnes AI 免费聊天</span>
          </Link>
          {mounted ? (
            <button
              onClick={() => setSettingsOpen(true)}
              className="hidden truncate rounded-full border border-border/70 bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground sm:block"
            >
              {settings.model}
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={toggleTheme} title="切换主题">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={clearChat} title="清空对话">
            <Eraser className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} title="设置">
            <Settings2 className="h-4 w-4" />
          </Button>

          {user ? (
            <>
              {user.role === "admin" ? (
                <Button variant="ghost" size="icon" asChild title="管理员">
                  <Link href="/admin">
                    <Shield className="h-4 w-4 text-primary" />
                  </Link>
                </Button>
              ) : null}
              <Button variant="ghost" size="icon" asChild title="账户">
                <Link href="/account">
                  <UserIcon className="h-4 w-4" />
                </Link>
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">
                <LogIn className="h-4 w-4" />
                登录
              </Link>
            </Button>
          )}
        </div>
      </header>

      {/* 消息区 */}
      <main className="relative z-0 flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex min-h-full items-center justify-center py-10">
            <EmptyState
              onStart={() => {
                if (typeof window !== "undefined" && window.innerWidth < 640) {
                  textareaRef.current?.focus();
                }
                toast.success("开始聊天吧 ✨");
              }}
              onPick={(text) => send(text)}
            />
          </div>
        ) : (
          <MessageList messages={messages} onRetry={retry} streamingId={streamingId} />
        )}
        <div ref={bottomRef} />
      </main>

      {/* 输入区 */}
      <div className="relative z-10 border-t border-border/60 bg-background/80 px-3 pb-3 pt-2 backdrop-blur-xl sm:px-4">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-end gap-2 rounded-2xl border border-border/70 bg-card/70 p-2 shadow-lg backdrop-blur-xl focus-within:border-primary/50">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              placeholder="发消息给 Agnes…（Enter 发送，Shift + Enter 换行）"
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(input);
                }
              }}
              className="max-h-[200px] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] leading-6 outline-none placeholder:text-muted-foreground"
            />
            {status === "streaming" ? (
              <Button size="icon" variant="secondary" onClick={stop} title="停止生成">
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={() => send(input)}
                disabled={!input.trim()}
                title="发送"
                className="shrink-0"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            仅聊天，无 Agent / 联网 / 文件上传。内容由模型生成，请注意甄别。
          </p>
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
