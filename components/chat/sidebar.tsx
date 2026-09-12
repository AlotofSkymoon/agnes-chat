"use client";

import * as React from "react";
import Link from "next/link";
import {
  LogIn,
  MessageSquare,
  PanelLeftClose,
  Plus,
  Settings2,
  Shield,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";

import { AgnesIcon } from "@/components/agnes-logo";
import { SITE_NAME } from "@/lib/site";
import { Button } from "@/components/ui/button";
import type { Conversation } from "@/lib/use-conversations";
import { cn } from "@/lib/utils";

interface SidebarProps {
  conversations: Conversation[];
  currentId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  onOpenSettings: () => void;
  open: boolean;
  onClose: () => void;
  user: { email: string; role: string } | null;
  /** 桌面端是否收起（宽度归零，主内容区补位） */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({
  conversations,
  currentId,
  onSelect,
  onNew,
  onDelete,
  onClearAll,
  onOpenSettings,
  open,
  onClose,
  user,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  return (
    <>
      {/* 移动端遮罩 */}
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={onClose}
          aria-hidden
        />
      ) : null}

      {/* 外层控制宽度（可收起），内层保持固定 260px，收起时内容被裁切而非挤压变形 */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 shrink-0 overflow-hidden border-r border-border bg-[hsl(var(--sidebar))] transition-[width,transform] duration-200 ease-out md:relative md:w-[260px] md:translate-x-0",
          open ? "w-[260px] translate-x-0" : "w-0 -translate-x-full",
          collapsed && "md:w-0 md:border-r-0",
        )}
        aria-hidden={collapsed ? true : undefined}
      >
        <div className="flex h-full w-[260px] flex-col">
          {/* 顶部：Logo + 收起/关闭 */}
          <div className="flex items-center justify-between px-3 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#4D6BFE] p-1.5 text-white">
                <AgnesIcon />
              </span>
              <span className="text-sm font-semibold">{SITE_NAME}</span>
            </Link>
            <div className="flex items-center gap-0.5">
              {onToggleCollapse ? (
                <button
                  onClick={onToggleCollapse}
                  className="hidden rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:block"
                  aria-label="收起侧边栏"
                  title="收起侧边栏"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              ) : null}
              <button
                onClick={onClose}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted md:hidden"
                aria-label="关闭侧边栏"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* 新对话 */}
          <div className="px-3 pb-2">
            <Button
              onClick={() => {
                onNew();
                onClose();
              }}
              className="w-full justify-start gap-2 bg-[#4D6BFE] text-white hover:bg-[#3757E4]"
              size="sm"
            >
              <Plus className="h-4 w-4" />
              开启新对话
            </Button>
          </div>

          {/* 历史对话 */}
          <div className="flex min-h-0 flex-1 flex-col px-3">
            <p className="px-1 pb-1.5 pt-2 text-xs font-medium text-fg-tertiary">历史对话</p>
            <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
              {conversations.length === 0 ? (
                <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                  暂无对话记录
                </p>
              ) : (
                <div className="space-y-0.5">
                  {conversations.map((c) => (
                    <div
                      key={c.id}
                      className={cn(
                        "group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
                        c.id === currentId
                          ? "bg-primary/10 text-primary"
                          : "text-[hsl(var(--sidebar-foreground))] hover:bg-muted",
                      )}
                    >
                      <button
                        onClick={() => {
                          onSelect(c.id);
                          onClose();
                        }}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
                        <span className="truncate">{c.title}</span>
                      </button>
                      <button
                        onClick={() => onDelete(c.id)}
                        className="shrink-0 rounded p-1 opacity-0 transition-opacity hover:bg-background group-hover:opacity-100"
                        title="删除对话"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 底部操作 */}
          <div className="space-y-0.5 border-t border-border px-3 py-2">
            <button
              onClick={onOpenSettings}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[hsl(var(--sidebar-foreground))] transition-colors hover:bg-muted"
            >
              <Settings2 className="h-4 w-4" />
              设置
            </button>
            {user ? (
              <>
                {user.role === "admin" ? (
                  <Link
                    href="/admin"
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[hsl(var(--sidebar-foreground))] transition-colors hover:bg-muted"
                  >
                    <Shield className="h-4 w-4" />
                    管理员面板
                  </Link>
                ) : null}
                <Link
                  href="/account"
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[hsl(var(--sidebar-foreground))] transition-colors hover:bg-muted"
                >
                  <UserIcon className="h-4 w-4" />
                  <span className="truncate">{user.email}</span>
                </Link>
              </>
            ) : (
              <Link
                href="/login"
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[hsl(var(--sidebar-foreground))] transition-colors hover:bg-muted"
              >
                <LogIn className="h-4 w-4" />
                登录 / 注册
              </Link>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
