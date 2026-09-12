"use client";

import * as React from "react";
import Link from "next/link";
import { Compass, LogIn, MessageSquare, Moon, Shield, Sun, User as UserIcon } from "lucide-react";

import { AgnesIcon } from "@/components/agnes-logo";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";

interface ChromeUser {
  id: string;
  email: string;
  role: "admin" | "user";
  createdAt: string;
}

/** 导航站 / 通用子页面的顶部栏（含主题切换、聊天入口、账户入口） */
export function NavChrome({ user }: { user?: ChromeUser | null }) {
  const { theme, toggleTheme } = useTheme();
  const [me, setMe] = React.useState<ChromeUser | null>(user ?? null);

  React.useEffect(() => {
    if (user) return;
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (alive && d?.user) setMe(d.user);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user]);

  return (
    <header className="relative z-10 flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5 backdrop-blur-xl sm:px-6">
      <Link href="/" className="flex items-center gap-2">
        <AgnesIcon className="h-7 w-7 text-[#4D6BFE]" />
        <span className="text-sm font-semibold sm:text-base">Agnes AI</span>
      </Link>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">聊天</span>
          </Link>
        </Button>
        <Button variant="ghost" size="icon" asChild title="导航">
          <Link href="/nav">
            <Compass className="h-4 w-4" />
          </Link>
        </Button>
        <Button variant="ghost" size="icon" onClick={toggleTheme} title="切换主题">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {me ? (
          <>
            {me.role === "admin" ? (
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
  );
}
