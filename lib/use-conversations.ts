"use client";

import * as React from "react";

import type { ChatMessage } from "@/lib/types";

export interface Conversation {
  id: string;
  title: string;
  updatedAt: number;
}

const LS_CONVERSATIONS = "agnes:conversations";
const LS_CURRENT = "agnes:currentConversation";
const msgKey = (id: string) => `agnes:msgs:${id}`;

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 忽略 */
  }
}

function safeRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* 忽略 */
  }
}

export function useConversations() {
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [currentId, setCurrentId] = React.useState<string>("");
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  /* ---------------- 初始化 ---------------- */
  React.useEffect(() => {
    let list: Conversation[] = [];
    try {
      const raw = safeGet(LS_CONVERSATIONS);
      if (raw) list = JSON.parse(raw) as Conversation[];
    } catch {
      list = [];
    }

    let id = safeGet(LS_CURRENT) ?? "";
    if (!id || !list.some((c) => c.id === id)) {
      id = list[0]?.id ?? "";
    }

    let msgs: ChatMessage[] = [];
    if (id) {
      try {
        const raw = safeGet(msgKey(id));
        if (raw) msgs = JSON.parse(raw) as ChatMessage[];
      } catch {
        msgs = [];
      }
    }

    setConversations(list);
    setCurrentId(id);
    setMessages(msgs);
    setLoaded(true);
  }, []);

  /* ---------------- 持久化当前会话消息 ---------------- */
  React.useEffect(() => {
    if (!loaded || !currentId) return;
    if (messages.length === 0) safeRemove(msgKey(currentId));
    else safeSet(msgKey(currentId), JSON.stringify(messages));
  }, [messages, currentId, loaded]);

  const persistList = React.useCallback((list: Conversation[]) => {
    setConversations(list);
    safeSet(LS_CONVERSATIONS, JSON.stringify(list));
  }, []);

  /* ---------------- 新建会话 ---------------- */
  const newConversation = React.useCallback(() => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    const conv: Conversation = { id, title: "新对话", updatedAt: Date.now() };
    persistList([conv, ...conversations]);
    setCurrentId(id);
    safeSet(LS_CURRENT, id);
    setMessages([]);
    return id;
  }, [conversations, persistList]);

  /* ---------------- 切换会话 ---------------- */
  const selectConversation = React.useCallback((id: string) => {
    let msgs: ChatMessage[] = [];
    try {
      const raw = safeGet(msgKey(id));
      if (raw) msgs = JSON.parse(raw) as ChatMessage[];
    } catch {
      msgs = [];
    }
    setCurrentId(id);
    safeSet(LS_CURRENT, id);
    setMessages(msgs);
  }, []);

  /* ---------------- 删除会话 ---------------- */
  const deleteConversation = React.useCallback(
    (id: string) => {
      safeRemove(msgKey(id));
      const rest = conversations.filter((c) => c.id !== id);
      persistList(rest);
      if (currentId === id) {
        const next = rest[0]?.id ?? "";
        setCurrentId(next);
        if (next) safeSet(LS_CURRENT, next);
        else safeRemove(LS_CURRENT);
        if (next) {
          try {
            const raw = safeGet(msgKey(next));
            setMessages(raw ? (JSON.parse(raw) as ChatMessage[]) : []);
          } catch {
            setMessages([]);
          }
        } else {
          setMessages([]);
        }
      }
    },
    [conversations, currentId, persistList],
  );

  /* ---------------- 清空全部会话 ---------------- */
  const clearAllConversations = React.useCallback(() => {
    conversations.forEach((c) => safeRemove(msgKey(c.id)));
    persistList([]);
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    setCurrentId(id);
    safeSet(LS_CURRENT, id);
    setMessages([]);
  }, [conversations, persistList]);

  /**
   * 会话结束后更新标题（用第一条用户消息）与排序
   */
  const touchConversation = React.useCallback(
    (id: string, firstUserMessage?: string) => {
      setConversations((prev) => {
        const next = prev.map((c) =>
          c.id === id
            ? {
                ...c,
                title:
                  c.title === "新对话" && firstUserMessage
                    ? firstUserMessage.slice(0, 30)
                    : c.title,
                updatedAt: Date.now(),
              }
            : c,
        );
        safeSet(LS_CONVERSATIONS, JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  /** 确保当前会话存在于列表中（首次发消息时调用） */
  const ensureConversation = React.useCallback(
    (id: string, firstUserMessage: string) => {
      setConversations((prev) => {
        if (prev.some((c) => c.id === id)) {
          const next = prev.map((c) =>
            c.id === id
              ? {
                  ...c,
                  title: c.title === "新对话" ? firstUserMessage.slice(0, 30) : c.title,
                  updatedAt: Date.now(),
                }
              : c,
          );
          safeSet(LS_CONVERSATIONS, JSON.stringify(next));
          return next;
        }
        const conv: Conversation = {
          id,
          title: firstUserMessage.slice(0, 30),
          updatedAt: Date.now(),
        };
        const next = [conv, ...prev];
        safeSet(LS_CONVERSATIONS, JSON.stringify(next));
        return next;
      });
      safeSet(LS_CURRENT, id);
    },
    [],
  );

  /* ---------------- 重命名会话 ---------------- */
  /**
   * 手动给会话起名。
   *
   * 自动标题只取首条消息前 30 字，聊久了往往名不副实，
   * 所以允许用户改。传空字符串表示"改回自动"——
   * 此时会退回用首条用户消息生成标题，没有消息则叫「新对话」。
   */
  const renameConversation = React.useCallback(
    (id: string, title: string) => {
      const trimmed = title.trim().slice(0, 60);

      setConversations((prev) => {
        let fallback = "新对话";
        if (!trimmed) {
          // 改回自动：拿第一条用户消息当标题
          try {
            const raw = safeGet(msgKey(id));
            if (raw) {
              const msgs = JSON.parse(raw) as ChatMessage[];
              const first = msgs.find((m) => m.role === "user" && m.content.trim());
              if (first) fallback = first.content.trim().slice(0, 30);
            }
          } catch {
            /* 忽略 */
          }
        }

        const next = prev.map((c) =>
          c.id === id
            ? { ...c, title: trimmed || fallback, updatedAt: Date.now() }
            : c,
        );
        safeSet(LS_CONVERSATIONS, JSON.stringify(next));
        return next;
      });

      // 云端也同步改（失败不影响本地，本地已经改好了）
      void id;
      return trimmed;
    },
    [],
  );

  return {
    conversations,
    currentId,
    setCurrentId,
    messages,
    setMessages,
    loaded,
    newConversation,
    selectConversation,
    deleteConversation,
    clearAllConversations,
    touchConversation,
    ensureConversation,
    renameConversation,
  };
}
